using System.Globalization;
using System.Text.Json;
using Sacou.Tests.Golden;

namespace Sacou.Modules.Matches.Tests.Formations;

/// <summary>The golden file has no id field, so a case goes by <c>system/rotation/phase</c>.</summary>
internal static class FormationGoldenIds
{
    public const int CaseCount = 26;

    public static readonly IReadOnlyList<string> All =
    [
        "5x1/1/receiving",
        "5x1/1/serving",
        "5x1/6/receiving",
        "5x1/6/serving",
        "5x1/5/receiving",
        "5x1/5/serving",
        "5x1/4/receiving",
        "5x1/4/serving",
        "5x1/3/receiving",
        "5x1/3/serving",
        "5x1/2/receiving",
        "5x1/2/serving",
        "6x2/1/receiving",
        "6x2/1/serving",
        "6x2/6/receiving",
        "6x2/6/serving",
        "6x2/5/receiving",
        "6x2/5/serving",
        "4x2/4/receiving",
        "4x2/4/serving",
        "4x2/3/receiving",
        "4x2/3/serving",
        "4x2/2/receiving",
        "4x2/2/serving",
        "livre/0/receiving",
        "livre/0/serving",
    ];

    public static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("formations.json");

    public static string IdOf(JsonElement goldenCase)
    {
        var rotation = GoldenFile.Number(goldenCase.GetProperty("rotation"), "rotation").ToString(CultureInfo.InvariantCulture);
        return $"{GoldenFile.Text(goldenCase, "system")}/{rotation}/{GoldenFile.Text(goldenCase, "phase")}";
    }
}
