using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;

namespace Sacou.Modules.Groups.CreateGroup;

/// <summary><c>POST /v1/groups</c> <c>{ name }</c>: 201 with the new group and the caller's member id.</summary>
internal static class CreateGroupEndpoint
{
    public const string Name = "CreateGroup";

    public static IEndpointRouteBuilder MapCreateGroup(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(GroupRouteExtensions.GroupsRoute, HandleAsync).WithName(Name).WithMetadata(GroupRouteExtensions.SmallBody());
        return endpoints;
    }

    private static async Task<Results<Created<CreateGroupResponse>, ProblemHttpResult>> HandleAsync(
        CreateGroupRequest request, CreateGroupHandler handler, CancellationToken cancellationToken)
    {
        var created = await handler.HandleAsync(request.Name, cancellationToken).ConfigureAwait(false);
        return created.ToHttpResult(response => TypedResults.Created($"{GroupRouteExtensions.GroupsRoute}/{response.GroupId}", response));
    }
}
