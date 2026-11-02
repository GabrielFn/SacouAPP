using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.Overlap;

/// <summary>Where each of the six players stands. A missing slot is a programming error, so it throws.</summary>
internal sealed class CourtPositions
{
    private readonly ImmutableDictionary<RotationSlot, CourtPoint> _points;

    public CourtPositions(IReadOnlyDictionary<RotationSlot, CourtPoint> points)
    {
        var missing = RotationSlot.All.FirstOrDefault(slot => !points.ContainsKey(slot));
        if (missing is not null)
        {
            throw new ArgumentException($"Slot {missing.Value} is missing.", nameof(points));
        }

        _points = RotationSlot.All.ToImmutableDictionary(slot => slot, slot => points[slot]);
    }

    public CourtPoint At(RotationSlot slot) => _points[slot];
}
