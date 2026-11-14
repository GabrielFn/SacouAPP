using System.Text.Json;
using Sacou.Modules.Sessions.Domain;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>
/// The venue text cases of the shared settings golden (<c>V10-venue-*</c>): <c>Venue.Create</c> must answer
/// like <c>checkDisplayText</c> in TypeScript. The app sends the text trimmed and in NFC, so a text that
/// <c>Venue.Create</c> would have to normalize counts as refused, as it is in the settings.
/// </summary>
public sealed class VenueGoldenTests
{
    private const string VenuePath = "schedule.venue";
    private const string IdPrefix = "V10-venue-";

    private static readonly Lazy<IReadOnlyList<JsonElement>> Cases = new(() => GoldenFile.ReadEmbeddedCases("settings-resolver.json"));

    public static TheoryData<string> VenueIds => new(
        Cases.Value.Select(GoldenFile.IdOf).Where(id => id.StartsWith(IdPrefix, StringComparison.Ordinal)));

    [Fact]
    public void TheVenueCasesAreThere() => Assert.Equal(7, VenueIds.Count);

    [Theory]
    [MemberData(nameof(VenueIds))]
    public void Create_AnswersLikeTheSettingsText(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases.Value, GoldenFile.IdOf, id);
        var text = goldenCase.GetProperty("document").GetProperty("set").GetProperty(VenuePath).GetString()!;
        var expectedOk = goldenCase.GetProperty("expected").GetProperty("ok").GetBoolean();

        var created = Venue.Create(text);

        var accepted = created.IsSuccess && string.Equals(created.Value.Value, text, StringComparison.Ordinal);
        Assert.True(expectedOk == accepted, $"{id}: expected ok={expectedOk}.");
    }
}
