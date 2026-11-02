using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

internal sealed record FormationSystem
{
    public static readonly FormationSystem FiveOne = new("5x1");
    public static readonly FormationSystem SixTwo = new("6x2");
    public static readonly FormationSystem FourTwo = new("4x2");
    public static readonly FormationSystem Livre = new("livre");

    public static readonly ImmutableArray<FormationSystem> All = [FiveOne, SixTwo, FourTwo, Livre];

    private FormationSystem(string code) => Code = code;

    public string Code { get; }
}
