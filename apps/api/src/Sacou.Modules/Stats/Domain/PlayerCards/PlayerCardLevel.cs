namespace Sacou.Modules.Stats.Domain.PlayerCards;

/// <param name="LevelTenths">The displayed level as a whole number of tenths: 38 reads as 3.8.</param>
/// <param name="Tier">Comes from the displayed level, so a card never reads "2.5 bronze".</param>
internal sealed record PlayerCardLevel(int LevelTenths, PlayerCardTier Tier);
