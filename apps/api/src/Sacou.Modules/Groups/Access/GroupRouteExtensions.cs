using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Domain.Permissions;

namespace Sacou.Modules.Groups.Access;

/// <summary>The only way to map a group route: the prefix, the access filter and its marker come together (ADR 0040, D3).</summary>
internal static class GroupRouteExtensions
{
    public const string GroupsRoute = "/v1/groups";
    public const string GroupRoute = GroupsRoute + "/{" + GroupAccessFilter.GroupIdRouteValue + ":guid}";

    /// <summary>Fits the largest body of E3.2 (a 60-character name or a 43-character token) with room to spare.</summary>
    public const long MaxBodyBytes = 4 * 1024;

    public static RouteGroupBuilder MapGroupRoutes(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(GroupRoute);
        group.AddEndpointFilter<GroupAccessFilter>();
        group.WithMetadata(GroupAccessFilterMetadata.Instance, SmallBody());
        ((IEndpointConventionBuilder)group).Finally(RequireOnePermission);
        return group;
    }

    public static RouteHandlerBuilder RequireGroupPermission(this RouteHandlerBuilder builder, GroupPermission permission) =>
        builder.WithMetadata(new GroupPermissionMetadata(permission));

    public static RequestSizeLimitAttribute SmallBody() => new(MaxBodyBytes);

    /// <summary>
    /// Runs when the endpoints are built, after every convention of the route: the API refuses to start with a
    /// group route that declares zero or two permissions, instead of failing on its first call.
    /// </summary>
    private static void RequireOnePermission(EndpointBuilder endpoint)
    {
        var declared = endpoint.Metadata.OfType<GroupPermissionMetadata>().Count();
        if (declared != 1)
        {
            throw new InvalidOperationException($"{endpoint.DisplayName}: a group route declares {declared} permissions, not one.");
        }
    }
}
