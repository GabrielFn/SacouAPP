using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

internal sealed record FormationSystemTemplate(
    string Label,
    ImmutableArray<RotationKey> RotationOrder,
    ImmutableDictionary<RotationKey, FormationTemplate> Rotations);
