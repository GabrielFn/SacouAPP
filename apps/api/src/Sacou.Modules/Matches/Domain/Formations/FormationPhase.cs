using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

internal sealed record FormationPhase
{
    public static readonly FormationPhase Receiving = new("receiving");
    public static readonly FormationPhase Serving = new("serving");

    public static readonly ImmutableArray<FormationPhase> All = [Receiving, Serving];

    private FormationPhase(string code) => Code = code;

    public string Code { get; }
}
