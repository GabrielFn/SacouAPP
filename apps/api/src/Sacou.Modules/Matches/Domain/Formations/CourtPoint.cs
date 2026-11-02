namespace Sacou.Modules.Matches.Domain.Formations;

/// <summary>
/// A point on the half court of the team. Always <see cref="double"/>: the shared golden files
/// compare these numbers with TypeScript bit by bit (ADR 0006).
/// </summary>
internal sealed record CourtPoint(double X, double Y);
