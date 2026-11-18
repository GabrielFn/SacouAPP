using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>
/// Read-only round lookup for the other modules (the Matches checks the round of a court stream, ADR 0060, D14).
/// Ids travel as <see cref="Guid"/>; a round is always read by <c>(groupId, roundId)</c>, never by a bare id.
/// </summary>
public interface IRoundDirectory
{
    /// <summary>The round of that group, or null when the group has no such round (a round of another group included).</summary>
    Task<RoundSummary?> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken);
}

/// <summary>What another module may know of a round: only whether it still happens.</summary>
public sealed record RoundSummary(RoundState State);

/// <summary>Mirrors the domain status, converted by hand: the domain enum stays internal.</summary>
public enum RoundState
{
    Scheduled,
    Canceled,
}

/// <summary>The Sessions answers another module repeats, so a missing round is the same body everywhere.</summary>
public static class RoundDirectoryErrors
{
    public static readonly Error RoundNotFound = Domain.Rounds.RoundErrors.RoundNotFound;
}
