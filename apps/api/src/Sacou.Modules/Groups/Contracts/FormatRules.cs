namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The format leaves a round shows outside the app (docs/dominio/configuracao.md): whether the score is kept, the points
/// of a set, and whether the "quem perde sai" queue is on.
/// </summary>
public sealed record FormatRules(bool ScoringEnabled, int PointsPerSet, bool QueueEnabled);
