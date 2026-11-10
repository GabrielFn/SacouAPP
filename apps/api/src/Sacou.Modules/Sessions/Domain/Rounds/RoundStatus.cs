namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>A round is never deleted: cancelling keeps the attendances for the history.</summary>
internal enum RoundStatus
{
    Scheduled,
    Canceled,
}
