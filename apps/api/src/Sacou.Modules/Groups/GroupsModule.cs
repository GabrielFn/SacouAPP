using Sacou.Modules.Groups.AddGuest;
using Sacou.Modules.Groups.CorrectGuest;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Groups.AcceptInvite;
using Sacou.Modules.Groups.ApplyTemplate;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.ChangeMemberRole;
using Sacou.Modules.Groups.ChangeMemberType;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.CreateGroup;
using Sacou.Modules.Groups.CreateInvite;
using Sacou.Modules.Groups.DeleteSavedTemplate;
using Sacou.Modules.Groups.GetGroup;
using Sacou.Modules.Groups.GetGroupSettings;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.InviteTokens;
using Sacou.Modules.Groups.LeaveGroup;
using Sacou.Modules.Groups.ListInvites;
using Sacou.Modules.Groups.ListMemberLevels;
using Sacou.Modules.Groups.ListSavedTemplates;
using Sacou.Modules.Groups.ListMembers;
using Sacou.Modules.Groups.ListMyGroups;
using Sacou.Modules.Groups.PreviewInvite;
using Sacou.Modules.Groups.RemoveMember;
using Sacou.Modules.Groups.RenameGroup;
using Sacou.Modules.Groups.RevokeInvite;
using Sacou.Modules.Groups.SaveTemplate;
using Sacou.Modules.Groups.SetMemberLevel;
using Sacou.Modules.Groups.SetMemberLevels;
using Sacou.Modules.Groups.UpdateGroupSettings;

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
        services.AddScoped<UpdateGroupSettingsHandler>();
        services.AddScoped<ApplyTemplateHandler>();
        services.AddScoped<SaveTemplateHandler>();
        services.AddScoped<SetMemberLevelsHandler>();
        services.AddScoped<AddGuestHandler>();
        services.AddSingleton<IInviteTokenGenerator, RandomInviteTokenGenerator>();
        services.AddScoped<IGroupMembership, StoreGroupMembership>();
        services.AddScoped<IGroupSettingsReader, StoreGroupSettingsReader>();
        services.AddScoped<IMemberLevels, StoreMemberLevels>();
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
            .MapRevokeInvite()
            .MapGetGroupSettings()
            .MapUpdateGroupSettings()
            .MapApplyTemplate()
            .MapListSavedTemplates()
            .MapSaveTemplate()
            .MapDeleteSavedTemplate()
            .MapListMemberLevels()
            .MapSetMemberLevel()
            .MapSetMemberLevels()
            .MapAddGuest()
            .MapCorrectGuest();
        return endpoints;
    }

    /// <summary>Applies the Groups migrations. The API calls it after the Identity ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        GroupsDatabase.MigrateAsync(services, cancellationToken);
}
