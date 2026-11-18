using Microsoft.Extensions.Logging;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>Ids, counts, codes and times only: never a payload, a body, a device id nor a member id (ADR 0060, D15).</summary>
internal static partial class CourtLog
{
    [LoggerMessage(Level = LogLevel.Information,
        Message = "Court events stored. Stream {CourtSessionId}: {Stored} stored, {Duplicates} duplicates, {ElapsedMs} ms.")]
    public static partial void Stored(ILogger logger, Guid courtSessionId, int stored, int duplicates, long elapsedMs);

    [LoggerMessage(Level = LogLevel.Information, Message = "Court events refused: {Code} {Reason}, {ElapsedMs} ms.")]
    public static partial void Refused(ILogger logger, string code, string reason, long elapsedMs);
}
