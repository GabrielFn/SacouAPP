using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Xunit;

namespace Sacou.Api.Tests.OpenApi;

/// <summary>
/// 4.6 (b) of E3.9 (ADR 0047): the contract the app compiles against has no trace of the hidden rating. Keys are
/// compared whole (a substring search would fail on <c>mvpFormulaVersion</c>, which contains "mu"), every key of the
/// document: property names, schema names, parameters and the error catalog's values.
/// </summary>
public sealed partial class OpenApiRatingSecrecyTests
{
    [GeneratedRegex("^(mu|sigma|ordinal|skill)$|rating", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RatingName();

    [Fact]
    public void Rule_CatchesAPlantedKey_AndNotTheMvpFormula()
    {
        var planted = JsonNode.Parse("""{"a":{"properties":{"mvpFormulaVersion":{},"Mu":{}}},"MemberRatingReport":{}}""")!;

        Assert.Equal(["Mu", "MemberRatingReport"], RatingNames(planted));
    }

    [Fact]
    public async Task Document_has_no_key_nor_code_about_the_rating()
    {
        var document = await ContractDocument.ParsedAsync();

        Assert.Contains("RoundSummaryReport", Keys(document));
        Assert.Empty(RatingNames(document));
    }

    private static List<string> RatingNames(JsonNode document) =>
        [.. Keys(document).Concat(Texts(document["x-sacou-error-codes"])).Where(name => RatingName().IsMatch(name))];

    private static IEnumerable<string> Keys(JsonNode? node) => node switch
    {
        JsonObject item => item.SelectMany(pair => Keys(pair.Value).Prepend(pair.Key)),
        JsonArray items => items.SelectMany(Keys),
        _ => [],
    };

    private static IEnumerable<string> Texts(JsonNode? node) =>
        node is JsonArray items ? items.Select(item => (string?)item ?? string.Empty) : [];
}
