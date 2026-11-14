using System.Collections.Immutable;
using System.Globalization;
using System.Text.Json.Serialization;
using Sacou.Modules.Sessions.Domain.Draw;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.DrawTeams;

/// <summary>
/// The body: the locks of screen 07 and, after a "Trocar" between a team and the bench, the reserve queue. Both
/// optional; <c>{}</c> is a plain draw. A field the record does not declare is a 400 (ADR 0039).
/// </summary>
internal sealed record DrawTeamsRequest(IReadOnlyList<DrawLockRequest?>? Locks, IReadOnlyList<Guid>? Reserves)
{
    /// <summary>A null item is a refused lock, like any other the domain refuses.</summary>
    public Result<ImmutableArray<DrawLock>> ToLocks()
    {
        var locks = Locks ?? [];
        return locks.Any(item => item is null)
            ? Result.Failure<ImmutableArray<DrawLock>>(DrawErrors.LockInvalid)
            : Result.Success(locks.OfType<DrawLockRequest>().Select(item => item.ToDomain()).ToImmutableArray());
    }

    public ImmutableArray<MemberId>? ToReserves() =>
        Reserves is null ? null : [.. Reserves.Select(member => new MemberId(member))];

    public override string ToString() => nameof(DrawTeamsRequest);
}

/// <summary>Every field required: an absent kind is a 400, never a default "together".</summary>
internal sealed record DrawLockRequest(
    [property: JsonRequired] Guid First,
    [property: JsonRequired] Guid Second,
    [property: JsonRequired] DrawLockKind Kind)
{
    public DrawLock ToDomain() => new(new MemberId(First), new MemberId(Second), Kind);
}

/// <summary>
/// The draw for the admin's screen (D3 of the plan): levels and averages in whole tenths (35 = 3,5). Never the origin
/// of a level, a nickname or the suggestion. <see cref="Seed"/> travels as text: a 64-bit number does not fit a
/// JavaScript number.
/// </summary>
internal sealed record DrawTeamsResponse(
    string Seed,
    int PlayersPerTeam,
    IReadOnlyList<DrawnTeamResponse> Teams,
    IReadOnlyList<DrawnPlayerResponse> Reserves,
    int DifferenceTenths)
{
    public static DrawTeamsResponse From(DrawResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        return new DrawTeamsResponse(
            result.Seed.ToString(CultureInfo.InvariantCulture),
            result.TeamSize,
            [.. result.Teams.Select(DrawnTeamResponse.From)],
            [.. result.Reserves.Select(DrawnPlayerResponse.From)],
            result.DifferenceTenths);
    }

    /// <summary>It carries private levels: never printed.</summary>
    public override string ToString() => nameof(DrawTeamsResponse);
}

/// <summary><see cref="Number"/> starts at 1; the members come in order of arrival.</summary>
internal sealed record DrawnTeamResponse(int Number, IReadOnlyList<DrawnPlayerResponse> Members, int AverageTenths)
{
    public static DrawnTeamResponse From(DrawnTeam team)
    {
        ArgumentNullException.ThrowIfNull(team);
        return new DrawnTeamResponse(team.Number, [.. team.Members.Select(DrawnPlayerResponse.From)], team.AverageTenths);
    }

    public override string ToString() => nameof(DrawnTeamResponse);
}

internal sealed record DrawnPlayerResponse(Guid MemberId, int LevelTenths)
{
    public static DrawnPlayerResponse From(DrawPlayer player)
    {
        ArgumentNullException.ThrowIfNull(player);
        return new DrawnPlayerResponse(player.MemberId.Value, player.LevelTenths);
    }

    public override string ToString() => nameof(DrawnPlayerResponse);
}
