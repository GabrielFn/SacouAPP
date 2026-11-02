using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.FormationCatalogs;

/// <summary>Everything here goes through <see cref="CatalogText.Parse"/>, so it all runs under a comma-decimal culture.</summary>
public sealed class FormationCatalogParserTests
{
    private const string Slot = "systems.5x1.rotations.1.receive.1";
    private const string Template = "systems.5x1.rotations.1";
    private const string SubstitutingTemplate = "systems.5x1.rotations.2";
    private const string PlainSlotValue = """{ "role": "S", "x": 0, "y": 0 }""";

    private static readonly FormationCatalog OriginalCatalog = CatalogText.Parse(CatalogText.Original);

    [Fact]
    public void Culture_UsesAComma_SoThatTheseTestsProveSomething()
    {
        Assert.Equal(",", CatalogText.CommaDecimalCulture.NumberFormat.NumberDecimalSeparator);
    }

    [Fact]
    public void ValidCatalog_HasEveryFormation()
    {
        Assert.Equal(
            [6, 3, 3, 1],
            FormationSystem.All.Select(system => OriginalCatalog.Systems[system].RotationOrder.Length));
    }

    [Theory]
    [InlineData("an unknown role", "systems.5x1.rotations.1.receive.1.role", "\"COACH\"")]
    [InlineData("a slot that does not exist", "systems.4x2.rotations.3.receive.7", PlainSlotValue)]
    [InlineData("a coordinate written as text", "systems.6x2.rotations.5.receive.3.x", "\"0.2\"")]
    [InlineData("a malformed base position", "coordinateSystem.basePositions.1", "[0.8]")]
    [InlineData("an unknown system", "systems.3x3", "{}")]
    [InlineData("a rotation order missing a rotation", "systems.5x1.rotationOrder", "[1, 6, 5]")]
    [InlineData("a rotation order with a foreign rotation", "systems.6x2.rotationOrder", "[1, 6, 4]")]
    [InlineData("a rotation order with a repeated rotation", "systems.6x2.rotationOrder", "[1, 6, 6]")]
    public void SameCorruptionsAsTypeScript_CiteTheSameField(string name, string field, string rawValue)
    {
        Assert.NotEmpty(name);
        AssertRejected(CatalogText.WithValue(field, rawValue), field);
    }

    [Theory]
    [InlineData("a missing slot", "systems.5x1.rotations.1.receive.2")]
    [InlineData("a role without a description", "roles.P6")]
    [InlineData("a missing system", "systems.livre")]
    public void SameRemovalsAsTypeScript_CiteTheSameField(string name, string field)
    {
        Assert.NotEmpty(name);
        AssertRejected(CatalogText.Without(field), field);
    }

    [Fact]
    public void UnknownServeSubstitutionRole_CitesTheField()
    {
        var field = $"{SubstitutingTemplate}.serveSubstitution";

        AssertRejected(CatalogText.WithValue(field, """{ "1": "COACH" }"""), $"{field}.1");
    }

    [Theory]
    [InlineData("\"0.2\"")]
    [InlineData("true")]
    [InlineData("null")]
    [InlineData("1e400")]
    [InlineData("-1e400")]
    [InlineData("1e999999999999")]
    public void CoordinateThatIsNotAFiniteNumber_CitesTheField(string rawValue)
    {
        AssertRejected(CatalogText.WithValue($"{Slot}.x", rawValue), $"{Slot}.x");
    }

    [Theory]
    [InlineData("null")]
    [InlineData("\"s\"")]
    [InlineData("\"COACH\"")]
    public void RoleOutsideTheList_CitesTheField(string rawValue)
    {
        AssertRejected(CatalogText.WithValue($"{Slot}.role", rawValue), $"{Slot}.role");
    }

    [Theory]
    [InlineData(Slot + ".role")]
    [InlineData(Slot + ".x")]
    [InlineData(Slot + ".y")]
    [InlineData(Template + ".note")]
    [InlineData(Template + ".liberoReplaces")]
    [InlineData(Template + ".serveSubstitution")]
    [InlineData("systems.5x1.label")]
    public void MissingField_CitesTheField(string field)
    {
        AssertRejected(CatalogText.Without(field), field);
    }

    [Fact]
    public void BasePositionWithThreeNumbers_CitesTheField()
    {
        var field = "coordinateSystem.basePositions.1";

        AssertRejected(CatalogText.WithValue(field, "[0.8, 1, 2]"), field);
    }

    [Fact]
    public void RootThatIsAnArray_CitesTheRoot()
    {
        AssertRejected("[]", "root");
    }

    [Fact]
    public void MissingCoordinateSystem_CitesTheField()
    {
        AssertRejected(CatalogText.Without("coordinateSystem"), "coordinateSystem");
    }

    [Theory]
    [InlineData("[1.5, 6, 5]", ".0")]
    [InlineData("""["1", 6, 5]""", ".0")]
    [InlineData("[null, 6, 5]", ".0")]
    [InlineData("[1, 6, 6]", "")]
    [InlineData("[1, 6]", "")]
    public void BadRotationOrder_CitesTheField(string rawValue, string suffix)
    {
        const string Field = "systems.6x2.rotationOrder";

        AssertRejected(CatalogText.WithValue(Field, rawValue), Field + suffix);
    }

    [Theory]
    [InlineData("7")]
    [InlineData("1.0")]
    [InlineData("01")]
    [InlineData("__proto__")]
    public void UnknownKeyInAMap_CitesTheKey(string key)
    {
        string[] maps =
        [
            $"{Template}.receive",
            "systems",
            "coordinateSystem.basePositions",
            "systems.5x1.rotations",
        ];

        Assert.All(maps, map => AssertRejected(CatalogText.WithMember(map, key, "{}"), $"{map}.{key}"));
    }

    [Theory]
    [InlineData("7")]
    [InlineData("1.0")]
    [InlineData("01")]
    [InlineData("__proto__")]
    public void UnknownKeyInServeSubstitution_CitesTheKey(string key)
    {
        var field = $"{SubstitutingTemplate}.serveSubstitution";

        AssertRejected(CatalogText.WithValue(field, $$"""{ "{{key}}": "S" }"""), $"{field}.{key}");
    }

    [Theory]
    [InlineData("2.5e-1")]
    [InlineData("0.250")]
    [InlineData("25e-2")]
    public void CoordinateInAnotherNotation_IsTheSameNumber(string rawValue)
    {
        var catalog = CatalogText.Parse(CatalogText.WithValue($"{Slot}.x", rawValue));

        GoldenFile.AssertExact(0.25, ReceiveOf(catalog, RotationSlot.One).Point.X, rawValue);
    }

    [Fact]
    public void CoordinateInAnotherNotation_DoesNotDependOnTheCulture()
    {
        var json = CatalogText.WithValue($"{Slot}.x", "2.5e-1");
        var previous = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
        try
        {
            using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));
            var inInvariantCulture = Sacou.Modules.Matches.FormationCatalogs.FormationCatalogParser.Parse(stream);

            CatalogAssert.Same(inInvariantCulture, CatalogText.Parse(json));
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void RotationOrderInAnotherNotation_IsTheSameKeys()
    {
        var catalog = CatalogText.Parse(CatalogText.WithValue("systems.6x2.rotationOrder", "[1.0, 6e0, 5.0]"));

        Assert.Equal(
            [RotationKey.One, RotationKey.Six, RotationKey.Five],
            catalog.Systems[FormationSystem.SixTwo].RotationOrder);
    }

    [Fact]
    public void NegativeZeroInRotationOrder_IsKeyZero()
    {
        var catalog = CatalogText.Parse(CatalogText.WithValue("systems.livre.rotationOrder", "[-0]"));

        Assert.Equal([RotationKey.Zero], catalog.Systems[FormationSystem.Livre].RotationOrder);
    }

    [Fact]
    public void ReversedKeys_GiveTheSameCatalog()
    {
        CatalogAssert.Same(OriginalCatalog, CatalogText.Parse(CatalogText.WithReversedKeys()));
    }

    [Fact]
    public void KeyWrittenWithAnEscape_IsTheSameKey()
    {
        // The first "1" after "receive" is the key of slot 1.
        var receiveAt = CatalogText.Original.IndexOf("\"receive\"", StringComparison.Ordinal);
        var keyAt = CatalogText.Original.IndexOf("\"1\"", receiveAt, StringComparison.Ordinal);
        var json = string.Concat(CatalogText.Original.AsSpan(0, keyAt), "\"\\u0031\"", CatalogText.Original.AsSpan(keyAt + 3));

        CatalogAssert.Same(OriginalCatalog, CatalogText.Parse(json));
    }

    [Theory]
    [InlineData(Template)]
    [InlineData("")]
    [InlineData(Slot)]
    public void ExtraFieldInAnObjectThatIsNotAMap_IsIgnored(string objectPath)
    {
        var catalog = CatalogText.Parse(CatalogText.WithMember(objectPath, "extra", "true"));

        CatalogAssert.Same(OriginalCatalog, catalog);
    }

    [Fact]
    public void EmptyServeSubstitution_IsAccepted()
    {
        var catalog = CatalogText.Parse(CatalogText.WithValue($"{SubstitutingTemplate}.serveSubstitution", "{}"));

        var template = catalog.Systems[FormationSystem.FiveOne].Rotations[RotationKey.Two];
        Assert.NotNull(template.ServeSubstitution);
        Assert.Empty(template.ServeSubstitution);
    }

    [Theory]
    [InlineData("\"rotationKey\":", "\"rotationKey\": \"x\", \"rotationKey\":")]
    [InlineData("\"role\": \"S\",", "\"role\": \"S\", \"role\": \"S\",")]
    [InlineData("\"x\": 0.95,", "\"x\": 0.95, \"x\": 0.95,")]
    [InlineData("\"x\": 0.95,", "\"x\": 0.95, \"\\u0078\": 0.95,")]
    [InlineData("\"rotationKey\":", "\"\\u0072otationKey\": \"x\", \"rotationKey\":")]
    public void RepeatedKey_IsRefused(string oldText, string newText)
    {
        var json = CatalogText.ReplacingFirst(oldText, newText);

        Assert.ThrowsAny<JsonException>(() => CatalogText.Parse(json));
    }

    [Fact]
    public void RepeatedKeyInAMap_IsRefused()
    {
        var json = CatalogText.ReplacingFirst("\"S1\":", "\"S1\": \"x\", \"S\\u0031\":");

        Assert.ThrowsAny<JsonException>(() => CatalogText.Parse(json));
    }

    [Theory]
    [InlineData("{ \"a\": 1, }")]
    [InlineData("/* comment */ {}")]
    [InlineData("{ \"a\": NaN }")]
    [InlineData("{ \"a\": 01 }")]
    [InlineData("")]
    public void MalformedJson_IsRefused(string json)
    {
        Assert.ThrowsAny<JsonException>(() => CatalogText.Parse(json));
    }

    private static ReceivePosition ReceiveOf(FormationCatalog catalog, RotationSlot slot) =>
        catalog.Systems[FormationSystem.FiveOne].Rotations[RotationKey.One].Receive[slot];

    private static void AssertRejected(string json, string field)
    {
        var failure = Assert.Throws<InvalidDataException>(() => CatalogText.Parse(json));

        Assert.Contains($"Invalid formation catalog at \"{field}\": expected ", failure.Message, StringComparison.Ordinal);
    }
}
