using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.ChangeMemberRole;
using Sacou.Modules.Groups.ChangeMemberType;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.CreateGroup;
using Sacou.Modules.Groups.GetGroup;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.LeaveGroup;
using Sacou.Modules.Groups.ListMembers;
using Sacou.Modules.Groups.ListMyGroups;
using Sacou.Modules.Groups.RemoveMember;
using Sacou.Modules.Groups.RenameGroup;

namespace Sacou.Modules.Groups;

/// <summary>Groups, members and roles, in the <c>groups</c> schema, with per-group authorization (ADR 0040).</summary>
public static class GroupsModule
{
    public static IServiceCollection AddGroupsModule(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.TryAddSingleton(TimeProvider.System);
        services.AddGroupsDatabase(configuration);
        services.AddScoped<CreateGroupHandler>();
        services.AddScoped<IGroupMembership, StoreGroupMembership>();
        return services;
    }

    /// <summary>
    /// Routes outside the group filter: only create and list mine. Every route with a group id goes through
    /// <see cref="GroupRouteExtensions.MapGroupRoutes"/>, guarded by a test over the whole API.
    /// </summary>
    public static IEndpointRouteBuilder MapGroupsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapCreateGroup().MapListMyGroups();
        endpoints.MapGroupRoutes()
            .MapGetGroup()
            .MapRenameGroup()
            .MapListMembers()
            .MapChangeMemberRole()
            .MapChangeMemberType()
            .MapRemoveMember()
            .MapLeaveGroup();
        return endpoints;
    }

    /// <summary>Applies the Groups migrations. The API calls it after the Identity ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        GroupsDatabase.MigrateAsync(services, cancellationToken);
}
