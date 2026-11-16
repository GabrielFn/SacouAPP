using System.Collections.Immutable;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Draw;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Levels;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.DrawTeams;

/// <summary>
/// Reads the round, its resolved settings and the levels of the confirmed players, then runs <see cref="TeamDraw"/>.
/// A read, so no lock: the access filter checked the capability against the database on this very request.
/// The players are the round's occupants still active in the group: one who left is not drawn, as the next read
/// of the round takes them out (ADR 0043, D7). The log holds ids and counts only (<see cref="RoundLog.Drew"/>).
/// </summary>
internal sealed class DrawTeamsHandler(
    IRoundStore store, GroupRoundContext groups, IMemberLevels levels, IDrawSeeds seeds, TimeProvider time, ILogger<DrawTeamsHandler> logger)
{
    private const string Drawn = "drawn";

    public async Task<Result<DrawTeamsResponse>> HandleAsync(
        RoundAccess access, RoundId id, DrawTeamsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        ArgumentNullException.ThrowIfNull(request);
        var started = time.GetTimestamp();
        var input = await InputAsync(access, id, request, cancellationToken).ConfigureAwait(false);
        if (input.IsFailure)
        {
            return Result.Failure<DrawTeamsResponse>(input.Error);
        }

        var drawn = TeamDraw.Run(input.Value);
        var elapsedMs = (long)time.GetElapsedTime(started).TotalMilliseconds;
        var result = drawn.IsSuccess ? Drawn : drawn.Error.Code;
        var teams = drawn.IsSuccess ? drawn.Value.Teams.Length : 0;
        RoundLog.Drew(logger, access.GroupId.Value, id.Value, result, input.Value.Players.Length, teams, input.Value.Locks.Length, elapsedMs);
        return drawn.IsSuccess
            ? Result.Success(DrawTeamsResponse.From(drawn.Value))
            : Result.Failure<DrawTeamsResponse>(drawn.Error);
    }

    private async Task<Result<DrawInput>> InputAsync(
        RoundAccess access, RoundId id, DrawTeamsRequest request, CancellationToken cancellationToken)
    {
        var round = await store.FindAsync(access.GroupId, id, cancellationToken).ConfigureAwait(false);
        if (round is null)
        {
            return Result.Failure<DrawInput>(RoundErrors.RoundNotFound);
        }

        if (round.IsCanceled)
        {
            return Result.Failure<DrawInput>(RoundErrors.RoundClosed);
        }

        var state = await groups.LoadAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        if (state.IsFailure)
        {
            return Result.Failure<DrawInput>(state.Error);
        }

        var rules = state.Value.ResolveStored(round).Settings.Draw;
        if (!rules.Enabled)
        {
            return Result.Failure<DrawInput>(DrawErrors.DrawDisabled);
        }

        var locks = request.ToLocks();
        if (locks.IsFailure)
        {
            return Result.Failure<DrawInput>(locks.Error);
        }

        var occupants = round.Occupants.Where(attendance => state.Value.ActiveIds.Contains(attendance.Member)).ToImmutableArray();
        var players = await PlayersAsync(access, occupants, cancellationToken).ConfigureAwait(false);
        return Result.Success(new DrawInput(
            players, rules.PlayersPerTeam, locks.Value, request.ToReserves(), rules.BalanceByLevel, seeds.Next()));
    }

    /// <summary>Every active member has a resolved level (a guest's is 3,0); the default only guards a gap in the contract.</summary>
    private async Task<ImmutableArray<DrawPlayer>> PlayersAsync(
        RoundAccess access, ImmutableArray<Attendance> occupants, CancellationToken cancellationToken)
    {
        Guid[] ids = [.. occupants.Select(attendance => attendance.Member.Value)];
        var resolved = await levels.ResolveAsync(access.GroupId.Value, ids, cancellationToken).ConfigureAwait(false);
        var byMember = resolved.ToDictionary(level => level.MemberId, level => level.LevelTenths);
        return [.. occupants.Select(attendance => new DrawPlayer(
            attendance.Member, byMember.GetValueOrDefault(attendance.Member.Value, SkillLevel.DefaultTenths), attendance.Sequence))];
    }
}
