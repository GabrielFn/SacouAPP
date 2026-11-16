using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.GetMyProfile;
using Sacou.Modules.Identity.Infrastructure;

namespace Sacou.Modules.Identity.ExportMyData;

/// <summary>
/// The account: only when it was created. Never the user id nor the Firebase subject (internal keys); the e-mail
/// and the provider live in Firebase and the app shows them on screen 30 (ADR 0056, D9).
/// </summary>
internal sealed class AccountExportSection(IUserStore users) : IAccountExportSection
{
    public string Name => AccountExportSections.Account;

    public int Order => AccountExportSections.AccountOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var createdAt = await users.FindCreatedAtAsync(new UserId(userId), cancellationToken).ConfigureAwait(false);
        return createdAt is { } value ? new AccountExport(value) : null;
    }
}

internal sealed record AccountExport(DateTimeOffset CreatedAt);

/// <summary>"Perfil: apelido e posições" of screen 30a, with the level the person suggested; null when never saved.</summary>
internal sealed class ProfileExportSection(IPlayerProfileStore profiles) : IAccountExportSection
{
    public string Name => AccountExportSections.Profile;

    public int Order => AccountExportSections.ProfileOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var profile = await profiles.FindAsync(new UserId(userId), cancellationToken).ConfigureAwait(false);
        return profile is null ? null : MyProfileResponse.From(profile);
    }
}
