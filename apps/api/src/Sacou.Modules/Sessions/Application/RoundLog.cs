using Microsoft.Extensions.Logging;
using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.Application;

/// <summary>
/// Everything the Sessions logs: ids and codes, never the venue (it may name a person), the settings layer,
/// a user or a name (docs/seguranca/dados-pessoais.md). The promotions also go to the Outbox, in the same transaction (ADR 0069); here they are counted.
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

    /// <summary>One line per draw: ids, counts and the time. Never a level, the body or the seed (ADR 0055).</summary>
    [LoggerMessage(Level = LogLevel.Information,
        Message = "Group {GroupId}: draw of round {RoundId}: {Result}, {Players} players, {Teams} teams, {Locks} locks, {ElapsedMs} ms.")]
    public static partial void Drew(ILogger logger, Guid groupId, Guid roundId, string result, int players, int teams, int locks, long elapsedMs);

    /// <summary>One line per confirmation of the teams: ids and counts, never who is in which team (ADR 0078).</summary>
    [LoggerMessage(Level = LogLevel.Information,
        Message = "Group {GroupId}: teams of round {RoundId}: {Result}, {Teams} teams, {Reserves} reserves.")]
    public static partial void TeamsConfirmed(ILogger logger, Guid groupId, Guid roundId, string result, int teams, int reserves);

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
