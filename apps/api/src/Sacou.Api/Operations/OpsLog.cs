namespace Sacou.Api.Operations;

/// <summary>
/// The dashboard's only log lines (ADR 0085, D4): what happened and how long it took. Never the subject, the address, a
/// number of the answer or a group's name.
/// </summary>
internal static partial class OpsLog
{
    [LoggerMessage(Level = LogLevel.Information, Message = "ops.denied")]
    public static partial void Denied(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "ops.served in {ElapsedMilliseconds} ms (cached: {Cached}).")]
    public static partial void Served(ILogger logger, long elapsedMilliseconds, bool cached);

    [LoggerMessage(Level = LogLevel.Warning, Message = "ops.unavailable: {ExceptionType}.")]
    public static partial void Unavailable(ILogger logger, string exceptionType);
}
