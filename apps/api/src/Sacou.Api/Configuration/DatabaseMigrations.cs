using Sacou.Modules.Groups;
using Sacou.Modules.Identity;
using Sacou.Modules.Matches;
using Sacou.Modules.Notifications;
using Sacou.Modules.Sessions;
using Sacou.Modules.Stats;

namespace Sacou.Api.Configuration;

/// <summary>Every module's migrations, in the order they depend on each other: the start and the operation commands share it.</summary>
internal static class DatabaseMigrations
{
    public static async Task ApplyAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        await IdentityModule.MigrateAsync(services, cancellationToken).ConfigureAwait(false);
        await GroupsModule.MigrateAsync(services, cancellationToken).ConfigureAwait(false);
        await SessionsModule.MigrateAsync(services, cancellationToken).ConfigureAwait(false);
        await MatchesModule.MigrateAsync(services, cancellationToken).ConfigureAwait(false);
        await StatsModule.MigrateAsync(services, cancellationToken).ConfigureAwait(false);
        await NotificationsModule.MigrateAsync(services, cancellationToken).ConfigureAwait(false);
    }
}
