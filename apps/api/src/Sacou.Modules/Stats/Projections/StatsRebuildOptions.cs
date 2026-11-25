using Microsoft.Extensions.Options;

namespace Sacou.Modules.Stats.Projections;

/// <summary>
/// How much one read of the Stats may rebuild, from <c>StatsRebuild</c> (ADR 0081, Part 2; condition of E3.9 part 4b):
/// at most <see cref="MaxRebuildsPerRequest"/> rounds and frozen MVP counts per request, the rest left for the next
/// read (question 189), and one read rebuilding a group at a time, the others waiting up to
/// <see cref="GroupWaitMilliseconds"/> and then reading what is stored.
/// </summary>
internal sealed class StatsRebuildOptions
{
    public const string SectionName = "StatsRebuild";

    private const int TwentyRebuilds = 20;
    private const int FiveSeconds = 5_000;

    public int MaxRebuildsPerRequest { get; set; } = TwentyRebuilds;

    public int GroupWaitMilliseconds { get; set; } = FiveSeconds;
}

/// <summary>Every number above zero. Runs on start, through <c>ValidateOnStart</c>.</summary>
internal sealed class StatsRebuildOptionsValidator : IValidateOptions<StatsRebuildOptions>
{
    private const int Minimum = 1;

    public ValidateOptionsResult Validate(string? name, StatsRebuildOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        List<string> failures =
        [
            .. Failure(nameof(options.MaxRebuildsPerRequest), options.MaxRebuildsPerRequest),
            .. Failure(nameof(options.GroupWaitMilliseconds), options.GroupWaitMilliseconds),
        ];
        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    private static IEnumerable<string> Failure(string setting, int value) =>
        value < Minimum ? [$"{StatsRebuildOptions.SectionName}:{setting} must be at least {Minimum}."] : [];
}
