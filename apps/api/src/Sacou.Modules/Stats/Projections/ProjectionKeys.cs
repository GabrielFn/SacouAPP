using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.Domain.Ratings;

namespace Sacou.Modules.Stats.Projections;

/// <summary>
/// The hashes of the inputs from outside a stream (ADR 0071, 3.9): only the hash is stored, never the facts nor a
/// level. Each line is fixed text in invariant culture, so the same inputs always give the same hash.
/// </summary>
internal static class ProjectionKeys
{
    /// <summary>Bumped with any change of the rules of the summary or of the projection: every row then rebuilds.</summary>
    public const int ProjectionVersion = 1;

    private const char Separator = '|';
    private const string InstantFormat = "O";
    private const string IdFormat = "D";

    /// <summary>The state, the start and the summary leaves of the round: changing one of them rebuilds its projection.</summary>
    public static string FactsHashOf(RoundFacts facts)
    {
        ArgumentNullException.ThrowIfNull(facts);
        return HashOf(string.Join(
            Separator,
            facts.State.ToString(),
            facts.StartsAt.UtcDateTime.ToString(InstantFormat, CultureInfo.InvariantCulture),
            facts.LocalDate.ToString(InstantFormat, CultureInfo.InvariantCulture),
            GameModalities.CodeOf(facts.Summary.Modality),
            facts.Summary.MvpEnabled.ToString(CultureInfo.InvariantCulture),
            facts.Summary.MvpByStats.ToString(CultureInfo.InvariantCulture),
            facts.Summary.IndividualPoints.ToString(CultureInfo.InvariantCulture)));
    }

    /// <summary>
    /// The inputs of a pool: the parameters version, its rounds in play order with the key of each projection, and
    /// the seed of each member, by id. Anything else that changes the fold changes one of these.
    /// </summary>
    public static string InputsHashOf(
        int paramsVersion, RatingPoolKind pool, IEnumerable<RoundProjection> rounds, IEnumerable<RatingSeed> seeds)
    {
        var builder = new StringBuilder()
            .Append(paramsVersion.ToString(CultureInfo.InvariantCulture)).Append(Separator).Append(pool.Code).Append('\n');
        foreach (var round in rounds)
        {
            _ = builder.Append(round.Facts.RoundId.ToString(IdFormat, CultureInfo.InvariantCulture)).Append(Separator)
                .Append(round.Stream?.CourtSessionId.ToString(IdFormat, CultureInfo.InvariantCulture)).Append(Separator)
                .Append(round.EventCount.ToString(CultureInfo.InvariantCulture)).Append(Separator)
                .Append(round.FactsHash).Append('\n');
        }

        foreach (var seed in seeds.OrderBy(seed => seed.MemberId.Value.ToString(IdFormat, CultureInfo.InvariantCulture), StringComparer.Ordinal))
        {
            _ = builder.Append(seed.MemberId.Value.ToString(IdFormat, CultureInfo.InvariantCulture)).Append(Separator)
                .Append(seed.LevelTenths.ToString(CultureInfo.InvariantCulture)).Append(Separator)
                .Append(seed.Source.Code).Append('\n');
        }

        return HashOf(builder.ToString());
    }

    private static string HashOf(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
}

/// <summary>The stored form of a summary: camelCase, enums by name, the same bytes for the same summary.</summary>
internal static class SummaryJson
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false) },
    };

    public static string Write(SessionSummary summary) => JsonSerializer.Serialize(summary, Options);

    /// <summary>Null for a stored text this version cannot read: the row is then rebuilt, like a stale one.</summary>
    public static SessionSummary? Read(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<SessionSummary>(json, Options);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
