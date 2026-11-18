namespace Sacou.Http.RateLimiting;

/// <summary>Codes of the answers the pipeline writes before any module runs, listed in the contract with the modules' codes.</summary>
public static class PipelineErrorCodes
{
    /// <summary>The 429 of the rate limiter (ADR 0062, D5).</summary>
    public const string RateLimited = "api.rate-limited";

    public static readonly IReadOnlyList<string> All = [RateLimited];
}
