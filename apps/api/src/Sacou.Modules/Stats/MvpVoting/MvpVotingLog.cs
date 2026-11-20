using Microsoft.Extensions.Logging;

namespace Sacou.Modules.Stats.MvpVoting;

/// <summary>
/// Everything the MVP vote logs: the round and the result code, never the voter, the candidate nor the pair (ADR 0072,
/// D7). A log line that told whom someone voted for would break the secret ballot.
/// </summary>
internal static partial class MvpVotingLog
{
    public const string CastResult = "cast";

    [LoggerMessage(Level = LogLevel.Information, Message = "MVP vote in round {RoundId}: {Result}.")]
    public static partial void Voted(ILogger logger, Guid roundId, string result);
}
