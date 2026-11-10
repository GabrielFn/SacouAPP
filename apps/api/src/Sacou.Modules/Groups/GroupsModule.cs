using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Groups.AcceptInvite;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.ChangeMemberRole;
using Sacou.Modules.Groups.ChangeMemberType;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.CreateGroup;
using Sacou.Modules.Groups.CreateInvite;
using Sacou.Modules.Groups.GetGroup;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.InviteTokens;
using Sacou.Modules.Groups.LeaveGroup;
using Sacou.Modules.Groups.ListInvites;
using Sacou.Modules.Groups.ListMembers;
using Sacou.Modules.Groups.ListMyGroups;
using Sacou.Modules.Groups.PreviewInvite;
using Sacou.Modules.Groups.RemoveMember;
using Sacou.Modules.Groups.RenameGroup;
using Sacou.Modules.Groups.RevokeInvite;

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
        services.AddScoped<CreateInviteHandler>();
        services.AddScoped<PreviewInviteHandler>();
        services.AddScoped<AcceptInviteHandler>();
        services.AddSingleton<IInviteTokenGenerator, RandomInviteTokenGenerator>();
        services.AddScoped<IGroupMembership, StoreGroupMembership>();
        return services;
    }

    /// <summary>
    /// Routes outside the group filter: create and list mine, and preview and accept an invite. Every route with a group id goes through
    /// <see cref="GroupRouteExtensions.MapGroupRoutes"/>, guarded by a test over the whole API.
    /// </summary>
    public static IEndpointRouteBuilder MapGroupsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapCreateGroup().MapListMyGroups().MapPreviewInvite().MapAcceptInvite();
        endpoints.MapGroupRoutes()
            .MapGetGroup()
            .MapRenameGroup()
            .MapListMembers()
            .MapChangeMemberRole()
            .MapChangeMemberType()
            .MapRemoveMember()
            .MapLeaveGroup()
            .MapCreateInvite()
            .MapListInvites()
            .MapRevokeInvite();
        return endpoints;
    }

    /// <summary>Applies the Groups migrations. The API calls it after the Identity ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        GroupsDatabase.MigrateAsync(services, cancellationToken);
}
