using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score;

/// <summary>One side of the net. <c>"a"</c> and <c>"b"</c> are the codes of the events.</summary>
internal sealed record TeamSide
{
    public static readonly TeamSide A = new("a");
    public static readonly TeamSide B = new("b");

    /// <summary>In the order of <c>TEAM_SIDES</c>: a search that finds both returns <see cref="A"/>.</summary>
    public static readonly ImmutableArray<TeamSide> All = [A, B];

    private TeamSide(string code) => Code = code;

    public string Code { get; }

    /// <summary>A method, not a property: a record would print it, and its opponent, forever.</summary>
    public TeamSide Opponent() => this == A ? B : A;
}

/// <summary>
/// A value for each side of the net, in the order <c>a</c>, <c>b</c> of the events: a set score,
/// sets won, the teams, their rotations.
/// </summary>
internal sealed record BySide<T>(T A, T B)
{
    public T Of(TeamSide side) => side == TeamSide.A ? A : B;

    public BySide<T> With(TeamSide side, T value) => side == TeamSide.A ? this with { A = value } : this with { B = value };
}
