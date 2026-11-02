using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.FormationCatalogs;

/// <summary>Field by field: the equality of a record stops at the reference of its collections.</summary>
internal static class CatalogAssert
{
    public static void Same(FormationCatalog expected, FormationCatalog actual)
    {
        foreach (var slot in RotationSlot.All)
        {
            SamePoint(expected.BasePositions[slot], actual.BasePositions[slot], $"base/{slot.Value}");
        }

        foreach (var system in FormationSystem.All)
        {
            SameSystem(system, expected.Systems[system], actual.Systems[system]);
        }
    }

    private static void SameSystem(FormationSystem system, FormationSystemTemplate expected, FormationSystemTemplate actual)
    {
        Assert.Equal(expected.Label, actual.Label);
        Assert.Equal(expected.RotationOrder, actual.RotationOrder);
        Assert.Equal(expected.Rotations.Count, actual.Rotations.Count);
        foreach (var rotation in expected.RotationOrder)
        {
            SameTemplate($"{system.Code}/{rotation.Value}", expected.Rotations[rotation], actual.Rotations[rotation]);
        }
    }

    private static void SameTemplate(string context, FormationTemplate expected, FormationTemplate actual)
    {
        Assert.Equal(expected.LiberoReplaces, actual.LiberoReplaces);
        Assert.Equal(expected.Note, actual.Note);
        Assert.Equal(expected.ServeSubstitution is null, actual.ServeSubstitution is null);
        foreach (var slot in RotationSlot.All)
        {
            Assert.Equal(expected.Receive[slot].Role, actual.Receive[slot].Role);
            SamePoint(expected.Receive[slot].Point, actual.Receive[slot].Point, $"{context}/{slot.Value}");
            Assert.Equal(expected.ServeSubstitution?.GetValueOrDefault(slot), actual.ServeSubstitution?.GetValueOrDefault(slot));
        }
    }

    private static void SamePoint(CourtPoint expected, CourtPoint actual, string context)
    {
        GoldenFile.AssertExact(expected.X, actual.X, $"{context}/x");
        GoldenFile.AssertExact(expected.Y, actual.Y, $"{context}/y");
    }
}
