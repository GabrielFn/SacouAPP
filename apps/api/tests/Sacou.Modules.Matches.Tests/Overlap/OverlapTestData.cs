using System.Collections.Immutable;
using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.Domain.Overlap;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.Overlap;

internal static class OverlapTestData
{
    public static readonly IReadOnlyList<string> AllRelations =
    [
        "1-behind-2",
        "6-behind-3",
        "5-behind-4",
        "4-left-of-3",
        "3-left-of-2",
        "5-left-of-6",
        "6-left-of-1",
    ];

    public static readonly IReadOnlyList<string> WithoutServingPlayer =
    [
        "6-behind-3",
        "5-behind-4",
        "4-left-of-3",
        "3-left-of-2",
        "5-left-of-6",
    ];

    public static readonly ImmutableDictionary<RotationSlot, CourtPoint> BasePoints = new Dictionary<RotationSlot, CourtPoint>
    {
        [RotationSlot.One] = new(0.75, 0.75),
        [RotationSlot.Two] = new(0.75, 0.25),
        [RotationSlot.Three] = new(0.5, 0.25),
        [RotationSlot.Four] = new(0.25, 0.25),
        [RotationSlot.Five] = new(0.25, 0.75),
        [RotationSlot.Six] = new(0.5, 0.75),
    }.ToImmutableDictionary();

    public static CourtPositions PositionsFromGolden(JsonElement slots, string context) =>
        new(RotationSlot.All.ToDictionary(slot => slot, slot =>
        {
            var point = slots.GetProperty(slot.Value.ToString(CultureInfo.InvariantCulture));
            return new CourtPoint(
                GoldenFile.Number(point.GetProperty("x"), context),
                GoldenFile.Number(point.GetProperty("y"), context));
        }));

    public static void AssertPassed(IEnumerable<string> expectedChecked, OverlapResult result)
    {
        var passed = Assert.IsType<OverlapResult.Passed>(result);
        Assert.Equal(expectedChecked, passed.Checked.Select(relation => relation.Id));
    }

    public static void AssertViolated(IEnumerable<string> expectedViolations, OverlapResult result)
    {
        var violated = Assert.IsType<OverlapResult.Violated>(result);
        Assert.Equal(expectedViolations, violated.Violations.Select(relation => relation.Id));
    }
}
