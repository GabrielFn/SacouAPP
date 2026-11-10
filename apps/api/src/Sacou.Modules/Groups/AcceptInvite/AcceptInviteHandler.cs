using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.InviteTokens;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.AcceptInvite;

/// <summary>
/// The acceptance (ADR 0040, D10): registered user, the token's format (no query for a malformed one), its
/// hash, then the store's one transaction, where the invite, the group lock, the person lock and the
/// aggregate's rule run in that order. The log keeps the outcome and the invite id, never the token, the
/// hash, the group's name or the person.
/// </summary>
internal sealed partial class AcceptInviteHandler(
    ICurrentUser currentUser, IGroupStore store, TimeProvider time, ILogger<AcceptInviteHandler> logger)
{
    private const string Joined = "joined";
    private const string AlreadyMember = "already-member";

    public async Task<Result<AcceptedInvite>> HandleAsync(string? token, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<AcceptedInvite>(user.Error);
        }

        var hash = InviteTokenHasher.HashIfWellFormed(token);
        if (hash.IsFailure)
        {
            LogAcceptance(logger, hash.Error.Code, inviteId: null);
            return Result.Failure<AcceptedInvite>(hash.Error);
        }

        var person = new UserId(user.Value.UserId);
        var now = time.GetUtcNow();
        var attempt = await store.AcceptInviteAsync(
            hash.Value, person, (group, invite, activeGroups) => group.Accept(invite, person, activeGroups, now), cancellationToken)
            .ConfigureAwait(false);
        var accepted = attempt.Change.Match(change => Result.Success(AcceptedInvite.From(change, person)), Result.Failure<AcceptedInvite>);
        var outcome = Outcome(accepted);
        LogAcceptance(logger, outcome, attempt.InviteId?.Value);
        return accepted;
    }

    private static string Outcome(Result<AcceptedInvite> accepted) =>
        accepted.Match(value => value.Joined ? Joined : AlreadyMember, error => error.Code);

    [LoggerMessage(Level = LogLevel.Information, Message = "Invite acceptance: {Outcome}, invite {InviteId}.")]
    private static partial void LogAcceptance(ILogger logger, string outcome, Guid? inviteId);
}

/// <summary>Where the person is now, and whether this call put them there (201) or they were in already (200).</summary>
internal sealed record AcceptedInvite(Guid GroupId, Guid MemberId, bool Joined)
{
    public static AcceptedInvite From(GroupChange change, UserId person)
    {
        ArgumentNullException.ThrowIfNull(change);
        var member = change.Group.ActiveMemberOf(person)
            ?? throw new InvalidOperationException("An accepted invite leaves the person as an active member.");
        return new AcceptedInvite(change.Group.Id.Value, member.Id.Value, Joined: !change.ChangedMembers.IsEmpty);
    }
}
