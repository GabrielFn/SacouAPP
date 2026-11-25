using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Application;

/// <summary>The settings of a round, resolved group then round, and its attendance rules as plain values for the domain.</summary>
internal sealed record ResolvedRound(RoundSettings Settings, AttendanceSettings Rules);

/// <summary>
/// What the Groups says about a group at one moment: its settings and its active members. Read through the
/// contract only, never from the <c>groups</c> tables (ADR 0043, D5 and D9). Loaded inside the round's lock
/// for a write, so the decision uses what is true after the lock was won.
/// </summary>
internal sealed class RoundGroupState
{
    private readonly IGroupSettingsReader reader;
    private readonly GroupSettingsSnapshot snapshot;
    private readonly ILogger logger;

    internal RoundGroupState(
        IGroupSettingsReader reader, GroupSettingsSnapshot snapshot, IReadOnlyList<GroupMembership> members, ILogger logger)
    {
        this.reader = reader;
        this.snapshot = snapshot;
        this.logger = logger;
        Members = members;
        ActiveIds = members.Select(member => new MemberId(member.MemberId)).ToHashSet();
    }

    public IReadOnlyList<GroupMembership> Members { get; }

    public IReadOnlySet<MemberId> ActiveIds { get; }

    /// <summary>A layer from a request: a refusal is <c>groups.settings-invalid</c> (400).</summary>
    public Result<ResolvedRound> ResolveRequested(string? layerJson)
    {
        var resolved = reader.ResolveRound(snapshot, layerJson);
        return resolved.IsSuccess ? Result.Success(Resolved(resolved.Value)) : Result.Failure<ResolvedRound>(resolved.Error);
    }

    /// <summary>
    /// A layer read from the database. It was validated on the way in, so a refusal means a damaged row: a 500
    /// that logs only the round id, never the layer.
    /// </summary>
    public ResolvedRound ResolveStored(Round round)
    {
        ArgumentNullException.ThrowIfNull(round);
        var resolved = reader.ResolveRound(snapshot, round.SettingsLayerJson);
        if (resolved.IsFailure)
        {
            RoundLog.StoredLayerInvalid(logger, round.Id.Value);
            throw new InvalidOperationException("A stored round layer is invalid.");
        }

        return Resolved(resolved.Value);
    }

    public MemberType? TypeOf(MemberId member) =>
        Members.FirstOrDefault(candidate => candidate.MemberId == member.Value)?.Type;

    /// <summary>The mensalistas in the order they joined the group: the order the seeding uses (question 24).</summary>
    public IReadOnlyList<MemberId> RegularsInJoinOrder() =>
        [.. Members.Where(member => member.Type == MemberType.Regular).Select(member => new MemberId(member.MemberId))];

    /// <summary>Whether any active member is a mensalista: without one the avulsos' window does not hold (ADR 0079, P3).</summary>
    public bool HasActiveRegular => HasRegular(Members);

    internal static bool HasRegular(IEnumerable<GroupMembership> members) =>
        members.Any(member => member.Type == MemberType.Regular);

    /// <summary>The attendance rules for the domain, as they hold for this group now.</summary>
    internal static AttendanceSettings ForGroup(Groups.Contracts.AttendanceRules rules, bool hasActiveRegular) =>
        ToDomain(rules).ForGroup(hasActiveRegular);

    private ResolvedRound Resolved(RoundSettings settings) => new(settings, ForGroup(settings.Attendance, HasActiveRegular));

    internal static AttendanceSettings ToDomain(Groups.Contracts.AttendanceRules rules) => new(
        rules.Enabled,
        rules.CapacityLimited,
        rules.Capacity,
        rules.WaitlistEnabled,
        rules.RegularsEnabled,
        rules.DropInWindowEnabled,
        rules.DropInOpensHoursBefore);
}

/// <summary>Builds <see cref="RoundGroupState"/> with the two reads the contract gives.</summary>
internal sealed class GroupRoundContext(IGroupSettingsReader settings, IGroupMembership membership, ILogger<GroupRoundContext> logger)
{
    public async Task<Result<RoundGroupState>> LoadAsync(GroupId group, CancellationToken cancellationToken)
    {
        var snapshot = await settings.GetAsync(group.Value, cancellationToken).ConfigureAwait(false);
        if (snapshot is null)
        {
            return Result.Failure<RoundGroupState>(GroupAccessErrors.GroupNotFound);
        }

        var members = await membership.ListActiveAsync(group.Value, cancellationToken).ConfigureAwait(false);
        return Result.Success(new RoundGroupState(settings, snapshot, members, logger));
    }

    /// <summary>Whether the caller still holds the capability now, under the lock: a demotion in between wins (ADR 0043, D5).</summary>
    public async Task<Result<GroupMembership>> CallerAsync(
        GroupId group, Guid userId, GroupCapability capability, CancellationToken cancellationToken)
    {
        var member = await membership.FindActiveAsync(group.Value, userId, cancellationToken).ConfigureAwait(false);
        if (member is null)
        {
            return Result.Failure<GroupMembership>(GroupAccessErrors.GroupNotFound);
        }

        return membership.Allows(member.Role, capability)
            ? Result.Success(member)
            : Result.Failure<GroupMembership>(GroupAccessErrors.Forbidden);
    }
}
