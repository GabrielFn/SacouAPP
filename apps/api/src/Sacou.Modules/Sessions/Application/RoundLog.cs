using Microsoft.Extensions.Logging;
using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.Application;

/// <summary>
/// Everything the Sessions logs: ids and codes, never the venue (it may name a person), the settings layer,
/// a user or a name (docs/seguranca/dados-pessoais.md). Events are not stored until the Outbox of E3.11; here they are counted.
/// </summary>
internal static partial class RoundLog
{
    [LoggerMessage(Level = LogLevel.Error, Message = "The stored settings layer of round {RoundId} is invalid.")]
    public static partial void StoredLayerInvalid(ILogger logger, Guid roundId);

    [LoggerMessage(Level = LogLevel.Information, Message = "Round {RoundId}: {Result}, {Events} events.")]
    public static partial void Wrote(ILogger logger, Guid roundId, string result, int events);

    [LoggerMessage(Level = LogLevel.Information, Message = "Group {GroupId}: round {RoundId} made by series {SeriesId}.")]
    public static partial void Materialized(ILogger logger, Guid groupId, Guid roundId, Guid seriesId);

    [LoggerMessage(Level = LogLevel.Information, Message = "Waitlist promotion in round {RoundId} for member {MemberId}.")]
    public static partial void Promoted(ILogger logger, Guid roundId, Guid memberId);

    [LoggerMessage(Level = LogLevel.Information, Message = "Group {GroupId}: series {SeriesId} stop: {Result}.")]
    public static partial void SeriesStopped(ILogger logger, Guid groupId, Guid seriesId, string result);

    /// <summary>One line per write: the result code and the promotions, by member id.</summary>
    public static void LogChange(ILogger logger, RoundId round, string result, RoundChange? change)
    {
        ArgumentNullException.ThrowIfNull(logger);
        Wrote(logger, round.Value, result, change?.Events.Length ?? 0);
        foreach (var promoted in change?.Events.OfType<WaitlistPromoted>() ?? [])
        {
            Promoted(logger, round.Value, promoted.MemberId.Value);
        }
    }
}
