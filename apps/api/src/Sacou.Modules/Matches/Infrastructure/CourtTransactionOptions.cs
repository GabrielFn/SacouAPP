using Microsoft.Extensions.Options;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// How long the transaction of a court stream (a write or a takeover) may wait and run, from <c>CourtTransaction</c>
/// (ADR 0081, Part 2). Past any of them the database stops it and the call is a 503 <c>matches.court-busy</c>: nobody
/// holds the stream's lock, a connection of the pool or a statement for long.
/// </summary>
internal sealed class CourtTransactionOptions
{
    public const string SectionName = "CourtTransaction";

    private const int TwoSeconds = 2_000;
    private const int FiveSeconds = 5_000;

    /// <summary>The wait for the stream's lock (<c>lock_timeout</c>).</summary>
    public int LockTimeoutMilliseconds { get; set; } = TwoSeconds;

    /// <summary>Each statement of the transaction (<c>statement_timeout</c>).</summary>
    public int StatementTimeoutMilliseconds { get; set; } = FiveSeconds;

    /// <summary>The transaction open with no statement running (<c>idle_in_transaction_session_timeout</c>).</summary>
    public int IdleInTransactionTimeoutMilliseconds { get; set; } = FiveSeconds;
}

/// <summary>Every time above zero: a zero turns the timeout off. Runs on start, through <c>ValidateOnStart</c>.</summary>
internal sealed class CourtTransactionOptionsValidator : IValidateOptions<CourtTransactionOptions>
{
    private const int Minimum = 1;

    public ValidateOptionsResult Validate(string? name, CourtTransactionOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        List<string> failures =
        [
            .. Failure(nameof(options.LockTimeoutMilliseconds), options.LockTimeoutMilliseconds),
            .. Failure(nameof(options.StatementTimeoutMilliseconds), options.StatementTimeoutMilliseconds),
            .. Failure(nameof(options.IdleInTransactionTimeoutMilliseconds), options.IdleInTransactionTimeoutMilliseconds),
        ];
        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    private static IEnumerable<string> Failure(string setting, int value) =>
        value < Minimum ? [$"{CourtTransactionOptions.SectionName}:{setting} must be at least {Minimum}."] : [];
}
