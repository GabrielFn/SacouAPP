using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.InviteTokens;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.PreviewInvite;

/// <summary>
/// What the person sees before tapping "Entrar": the group's name and size, and whether they are in already.
/// Registered user, then the token's format (no query for a malformed one), then the invite by its hash.
/// Revoked, expired, missing and malformed are the same <c>groups.invite-invalid</c> (ADR 0040, D10).
/// </summary>
internal sealed class PreviewInviteHandler(ICurrentUser currentUser, IGroupStore store, TimeProvider time)
{
    public async Task<Result<PreviewInviteResponse>> HandleAsync(string? token, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<PreviewInviteResponse>(user.Error);
        }

        var hash = InviteTokenHasher.HashIfWellFormed(token);
        if (hash.IsFailure)
        {
            return Result.Failure<PreviewInviteResponse>(hash.Error);
        }

        var preview = await store.FindInvitePreviewAsync(hash.Value, new UserId(user.Value.UserId), cancellationToken).ConfigureAwait(false);
        return preview is not null && preview.Invite.IsValidAt(time.GetUtcNow())
            ? Result.Success(new PreviewInviteResponse(preview.GroupName.Value, preview.ActiveMembers, preview.AlreadyMember))
            : Result.Failure<PreviewInviteResponse>(GroupErrors.InviteInvalid);
    }
}

/// <summary>Only what the screen needs: no group id, no member list, no one's id.</summary>
internal sealed record PreviewInviteResponse(string GroupName, int ActiveMembers, bool AlreadyMember);
