using System.Text.Json;
using Sacou.Modules.Stats.Domain.Ratings;

namespace Sacou.Modules.Stats.RatingParameters;

/// <summary>
/// Port of <c>packages/rating/src/params.ts</c>. A broken file is a build defect rather than a business rule,
/// so it throws while loading, naming the field, like the formation catalog (ADR 0025). Stricter than
/// TypeScript on two points that JavaScript cannot see: a repeated key and a key outside the list fail.
/// </summary>
internal static class RatingParamsParser
{
    private const string LimitSigmaKey = "limitSigma";

    private static readonly JsonDocumentOptions StrictOptions = new() { AllowDuplicateProperties = false };

    private static readonly string[] NumberKeys =
    [
        "ratingParamsVersion",
        "mu0",
        "levelStep",
        "sigmaAdmin",
        "sigmaUnconfirmed",
        "beta",
        "tau",
        "kappa",
    ];

    public static RatingParams Parse(Stream json)
    {
        using var document = JsonDocument.Parse(json, StrictOptions);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
        {
            throw Invalid("$", "an object");
        }

        var unknown = root.EnumerateObject().Select(member => member.Name).FirstOrDefault(name => name != LimitSigmaKey && !NumberKeys.Contains(name));
        if (unknown is not null)
        {
            throw Invalid(unknown, "no such key");
        }

        var version = Positive(root, NumberKeys[0]);
        if (version != Math.Floor(version) || version > int.MaxValue)
        {
            throw Invalid(NumberKeys[0], "an integer");
        }

        return new RatingParams(
            (int)version,
            Positive(root, "mu0"),
            Positive(root, "levelStep"),
            Positive(root, "sigmaAdmin"),
            Positive(root, "sigmaUnconfirmed"),
            Positive(root, "beta"),
            Positive(root, "tau"),
            Positive(root, "kappa"),
            Boolean(root, LimitSigmaKey));
    }

    private static double Positive(JsonElement root, string key) =>
        root.TryGetProperty(key, out var value)
        && value.ValueKind == JsonValueKind.Number
        && value.TryGetDouble(out var number)
        && double.IsFinite(number)
        && number > 0
            ? number
            : throw Invalid(key, "a positive number");

    private static bool Boolean(JsonElement root, string key) =>
        root.TryGetProperty(key, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False
            ? value.GetBoolean()
            : throw Invalid(key, "a boolean");

    private static InvalidOperationException Invalid(string key, string expected) =>
        new($"Invalid rating parameters at \"{key}\": expected {expected}.");
}
