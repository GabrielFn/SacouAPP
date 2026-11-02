using System.Collections.Immutable;

namespace Sacou.Modules.Stats.Domain.PlayerCards;

internal sealed record PlayerCardTier
{
    public static readonly PlayerCardTier Bronze = new("bronze");
    public static readonly PlayerCardTier Silver = new("silver");
    public static readonly PlayerCardTier Gold = new("gold");
    public static readonly PlayerCardTier Elite = new("elite");

    public static readonly ImmutableArray<PlayerCardTier> All = [Bronze, Silver, Gold, Elite];

    private PlayerCardTier(string code) => Code = code;

    public string Code { get; }
}
