using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// The ids only while the round is open (not cancelled, before <c>StartsAt</c>): a closed round says just that, so a link
/// that outlived its round gives nobody the way to the group (ADR 0070, D3). The page reads "rodada encerrada" from the
/// public summary, never from these ids.
/// </summary>
internal sealed record ResolvedRoundLinkResponse(bool IsOpen, Guid? GroupId, Guid? RoundId, bool IsMember);

internal sealed class ResolveRoundLinkHandler(
    ICurrentUser currentUser, RoundLinkReader reader, IGroupMembership membership, TimeProvider time)
{
    public async Task<Result<ResolvedRoundLinkResponse>> HandleAsync(string? code, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<ResolvedRoundLinkResponse>(user.Error);
        }

        var found = await reader.FindAsync(code, cancellationToken).ConfigureAwait(false);
        if (found.IsFailure)
        {
            return Result.Failure<ResolvedRoundLinkResponse>(found.Error);
        }

        var round = found.Value;
        var group = round.GroupId.Value;
        var member = await membership.FindActiveAsync(group, user.Value.UserId, cancellationToken).ConfigureAwait(false);
        var isMember = member is not null;
        return Result.Success(round.IsOpenForLinkAt(time.GetUtcNow())
            ? new ResolvedRoundLinkResponse(IsOpen: true, group, round.Id.Value, isMember)
            : new ResolvedRoundLinkResponse(IsOpen: false, GroupId: null, RoundId: null, isMember));
    }
}
