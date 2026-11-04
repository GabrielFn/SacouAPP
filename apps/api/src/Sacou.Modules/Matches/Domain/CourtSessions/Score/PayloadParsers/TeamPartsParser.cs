using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>
/// The parts that several payloads share: rosters, lineups, the libero and the queue. Port of the
/// helpers of <c>score/parse-payloads.ts</c>, with the same order of checks and the same fields.
/// </summary>
internal static class TeamPartsParser
{
    /// <summary>A libero that is not off, read or refused: a tri-state without the TypeScript <c>undefined</c>.</summary>
    internal sealed record LiberoFormat(bool IsValid, TeamLibero? Libero)
    {
        public static readonly LiberoFormat Invalid = new(false, null);
        public static readonly LiberoFormat Off = new(true, null);
    }

    public static Result<T, PayloadError> Invalid<T>(string field)
        where T : notnull
        => Result<T, PayloadError>.Failure(new PayloadError(field));

    public static ImmutableArray<string>? MemberIds(RawValue? value) =>
        PayloadValues.UniqueMemberIds(value, ScoreLimits.MinTeamMembers, ScoreLimits.MaxTeamMembers);

    public static ImmutableArray<string>? LineupMembers(RawValue? value) =>
        PayloadValues.UniqueMemberIds(value, ScoreLimits.LineupMembers, ScoreLimits.LineupMembers);

    public static ImmutableArray<string>? BenchMembers(RawValue? value) =>
        PayloadValues.UniqueMemberIds(value, ScoreLimits.MinBenchMembers, ScoreLimits.MaxBenchMembers);

    public static Result<BySide<TeamRoster>, PayloadError> ParseTeams(RawValue? value)
    {
        if (value is not RawObject record)
        {
            return Invalid<BySide<TeamRoster>>(PayloadFields.Teams);
        }

        var a = Roster(PayloadValues.Member(record, PayloadFields.SideA), PayloadFields.SideA);
        if (a.IsFailure)
        {
            return a.Forward<BySide<TeamRoster>>();
        }

        var b = Roster(PayloadValues.Member(record, PayloadFields.SideB), PayloadFields.SideB);
        if (b.IsFailure)
        {
            return b.Forward<BySide<TeamRoster>>();
        }

        var hasSharedMember = b.Value.MemberIds.Any(memberId => a.Value.MemberIds.Contains(memberId, StringComparer.Ordinal));
        return hasSharedMember
            ? Invalid<BySide<TeamRoster>>(PayloadFields.Path(PayloadFields.Teams, PayloadFields.SideB, PayloadFields.MemberIds))
            : Result<BySide<TeamRoster>, PayloadError>.Success(new BySide<TeamRoster>(a.Value, b.Value));
    }

    /// <summary>Format only, and JSON null turns the libero off: someone neither in the lineup nor on the bench.</summary>
    public static LiberoFormat ParseLibero(RawValue? value, ImmutableArray<string> lineup, ImmutableArray<string> bench)
    {
        if (PayloadValues.IsNull(value))
        {
            return LiberoFormat.Off;
        }

        if (value is not RawObject record
            || PayloadValues.Uuid(PayloadValues.Member(record, PayloadFields.MemberId)) is not { } memberId
            || lineup.Contains(memberId, StringComparer.Ordinal)
            || bench.Contains(memberId, StringComparer.Ordinal))
        {
            return LiberoFormat.Invalid;
        }

        return PayloadValues.ReplacedIndexes(PayloadValues.Member(record, PayloadFields.ReplacedIndexes)) is { } replacedIndexes
            ? new LiberoFormat(true, new TeamLibero(memberId, replacedIndexes))
            : LiberoFormat.Invalid;
    }

    /// <summary>JSON null turns the rotation of that team off.</summary>
    public static Result<Optional<TeamState>, PayloadError> ParseTeamState(RawValue? value, TeamRoster roster, string side)
    {
        string FieldOf(string key) => PayloadFields.Path(PayloadFields.Rotations, side, key);

        if (PayloadValues.IsNull(value))
        {
            return Result<Optional<TeamState>, PayloadError>.Success(Optional<TeamState>.None);
        }

        if (value is not RawObject record)
        {
            return Invalid<Optional<TeamState>>(PayloadFields.Path(PayloadFields.Rotations, side));
        }

        if (MatchLineup(PayloadValues.Member(record, PayloadFields.Lineup), roster) is not { } lineup)
        {
            return Invalid<Optional<TeamState>>(FieldOf(PayloadFields.Lineup));
        }

        if (PayloadValues.SetterZone(PayloadValues.Member(record, PayloadFields.SetterZone)) is not { } setterZone)
        {
            return Invalid<Optional<TeamState>>(FieldOf(PayloadFields.SetterZone));
        }

        if (PayloadValues.System(PayloadValues.Member(record, PayloadFields.System)) is not { } system)
        {
            return Invalid<Optional<TeamState>>(FieldOf(PayloadFields.System));
        }

        if (BenchMembers(PayloadValues.Member(record, PayloadFields.Bench)) is not { } bench)
        {
            return Invalid<Optional<TeamState>>(FieldOf(PayloadFields.Bench));
        }

        var libero = ParseLibero(PayloadValues.Member(record, PayloadFields.Libero), lineup, bench);
        if (!IsMatchLibero(libero, system, roster))
        {
            return Invalid<Optional<TeamState>>(FieldOf(PayloadFields.Libero));
        }

        // Whoever of the frozen copy is not in the lineup nor the libero, each one once.
        return RotationRules.IsRosterPartition(lineup, bench, libero.Libero, roster)
            ? Result<Optional<TeamState>, PayloadError>.Success(
                Optional<TeamState>.Some(new TeamState(bench, libero.Libero, lineup, setterZone, system)))
            : Invalid<Optional<TeamState>>(FieldOf(PayloadFields.Bench));
    }

    /// <summary>Exactly one player per position, and all of them from the team of the frozen copy.</summary>
    private static ImmutableArray<string>? MatchLineup(RawValue? value, TeamRoster roster) =>
        LineupMembers(value) is { } lineup
            && lineup.All(memberId => roster.MemberIds.Contains(memberId, StringComparer.Ordinal))
            ? lineup
            : null;

    /// <summary>The libero of a team that starts a match: its format, allowed by the system, from the roster.</summary>
    private static bool IsMatchLibero(LiberoFormat libero, FormationSystem system, TeamRoster roster) =>
        libero.IsValid
        && LiberoRules.IsLiberoAllowed(system, libero.Libero)
        && (libero.Libero is not { } teamLibero || roster.MemberIds.Contains(teamLibero.MemberId, StringComparer.Ordinal));

    /// <summary>Format only: teams, then players, nobody twice, and at most <see cref="QueueRules.MaxQueueMembers"/> in all.</summary>
    public static Result<TeamQueue, PayloadError> ParseQueue(RawValue? value)
    {
        if (value is not RawObject record)
        {
            return Invalid<TeamQueue>(PayloadFields.Queue);
        }

        if (QueueTeams(PayloadValues.Member(record, PayloadFields.Teams)) is not { } teams)
        {
            return Invalid<TeamQueue>(PayloadFields.Path(PayloadFields.Queue, PayloadFields.Teams));
        }

        var players = PayloadValues.UniqueMemberIds(
            PayloadValues.Member(record, PayloadFields.Players), ScoreLimits.MinQueuePlayers, QueueRules.MaxQueueMembers);
        var inTeams = teams.SelectMany(team => team.MemberIds).ToImmutableArray();
        if (players is not { } queuePlayers || queuePlayers.Any(memberId => inTeams.Contains(memberId, StringComparer.Ordinal)))
        {
            return Invalid<TeamQueue>(PayloadFields.Path(PayloadFields.Queue, PayloadFields.Players));
        }

        var queue = new TeamQueue(queuePlayers, teams);
        return QueueRules.QueueSize(queue) > QueueRules.MaxQueueMembers
            ? Invalid<TeamQueue>(PayloadFields.Queue)
            : Result<TeamQueue, PayloadError>.Success(queue);
    }

    private static Result<TeamRoster, PayloadError> Roster(RawValue? value, string side)
    {
        if (value is not RawObject record)
        {
            return Invalid<TeamRoster>(PayloadFields.Path(PayloadFields.Teams, side));
        }

        return MemberIds(PayloadValues.Member(record, PayloadFields.MemberIds)) is { } memberIds
            ? Result<TeamRoster, PayloadError>.Success(new TeamRoster(memberIds))
            : Invalid<TeamRoster>(PayloadFields.Path(PayloadFields.Teams, side, PayloadFields.MemberIds));
    }

    /// <summary>Each team from 1 to the team limit, and nobody in two of them. The size is checked before walking.</summary>
    private static ImmutableArray<TeamRoster>? QueueTeams(RawValue? value)
    {
        if (value is not RawArray { Items: var items } || items.Length > QueueRules.MaxQueueMembers)
        {
            return null;
        }

        ImmutableArray<TeamRoster> teams =
        [
            .. items
                .Select(item => item is RawObject team ? MemberIds(PayloadValues.Member(team, PayloadFields.MemberIds)) : null)
                .OfType<ImmutableArray<string>>()
                .Select(memberIds => new TeamRoster(memberIds)),
        ];
        if (teams.Length != items.Length)
        {
            return null;
        }

        var members = teams.SelectMany(team => team.MemberIds).ToList();
        return members.Distinct(StringComparer.Ordinal).Count() == members.Count ? teams : null;
    }
}
