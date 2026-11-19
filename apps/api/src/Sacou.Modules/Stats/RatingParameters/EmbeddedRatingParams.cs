using System.Reflection;
using Sacou.Modules.Stats.Domain.Ratings;

namespace Sacou.Modules.Stats.RatingParameters;

/// <summary>Reads the parameters built into this assembly: no copy and no disk access in production (ADR 0071, as ADR 0006).</summary>
internal static class EmbeddedRatingParams
{
    public const string ResourceName = "Sacou.Modules.Stats.rating-params.json";

    public static RatingParams Load() => Load(typeof(EmbeddedRatingParams).Assembly, ResourceName);

    public static RatingParams Load(Assembly assembly, string resourceName)
    {
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource \"{resourceName}\" not found.");
        return RatingParamsParser.Parse(stream);
    }
}
