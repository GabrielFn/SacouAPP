namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The draw leaves of a round, already resolved from the group and the round layer (docs/dominio/configuracao.md):
/// whether the draw is on, whether it balances by level, and the team size of <c>format.modality</c>.
/// </summary>
public sealed record DrawRules(bool Enabled, bool BalanceByLevel, int PlayersPerTeam);
