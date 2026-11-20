using Microsoft.Extensions.Logging;

namespace Sacou.Modules.Stats.Projections;

/// <summary>Ids, counts, codes and times only: never a summary, a level, a seed nor a value of the rating (ADR 0071).</summary>
internal static partial class StatsLog
{
    [LoggerMessage(Level = LogLevel.Information,
        Message = "Round projection rebuilt. Round {RoundId}: {EventCount} events, stored {Stored}, {ElapsedMs} ms.")]
    public static partial void RoundRebuilt(ILogger logger, Guid roundId, int eventCount, bool stored, long elapsedMs);

    [LoggerMessage(Level = LogLevel.Information, Message = "Rating pool rebuilt. Group {GroupId}, pool {Pool}: {Members} members.")]
    public static partial void PoolRebuilt(ILogger logger, Guid groupId, string pool, int members);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Rating pool not rated. Group {GroupId}: {Code}.")]
    public static partial void PoolNotRated(ILogger logger, Guid groupId, string code);
}
