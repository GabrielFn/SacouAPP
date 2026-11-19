using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// <see cref="IGroupJoining"/> over the store's one transaction. The log keeps the outcome only (<c>joined</c>,
/// <c>already-member</c> or the error code): never the group, the person or how they got here.
/// </summary>
internal sealed partial class StoreGroupJoining(
    IGroupStore store, IRegisteredUsers registeredUsers, TimeProvider time, ILogger<StoreGroupJoining> logger) : IGroupJoining
{
    private const string Joined = "joined";
    private const string AlreadyMember = "already-member";

    public async Task<Result<JoinedMember>> JoinAsDropInAsync(Guid groupId, Guid userId, CancellationToken cancellationToken)
    {
        var person = new UserId(userId);
        var now = time.GetUtcNow();
        var changed = await store.JoinAsync(
            new GroupId(groupId),
            person,
            cancellation => registeredUsers.ConfirmAsync(person.Value, cancellation),
            (group, activeGroups) => group.JoinAsDropIn(person, activeGroups, now),
            cancellationToken)
            .ConfigureAwait(false);
        var joined = changed.Match(change => Result.Success(ToJoined(change, person)), Result.Failure<JoinedMember>);
        var outcome = joined.Match(value => value.Joined ? Joined : AlreadyMember, error => error.Code);
        LogJoin(logger, outcome);
        return joined;
    }

    private static JoinedMember ToJoined(GroupChange change, UserId person)
    {
        var member = change.Group.ActiveMemberOf(person)
            ?? throw new InvalidOperationException("A way in leaves the person as an active member.");
        return new JoinedMember(member.Id.Value, Joined: !change.ChangedMembers.IsEmpty);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Group join by a round link: {Outcome}.")]
    private static partial void LogJoin(ILogger logger, string outcome);
}
