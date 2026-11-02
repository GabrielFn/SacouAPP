using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.Domain.PlayerCards;

internal static class PlayerCardLevelCalculator
{
    /// <summary>The rating that converts exactly to level 3.0.</summary>
    private const double AnchorRating = 1500;
    private const double AnchorLevelTenths = 30;

    /// <summary>100 rating points are worth 0.5 of a level (ADR 0018).</summary>
    private const double RatingPointsPerTenth = 20;

    /// <summary>Added before Math.Floor so that halves round up, on every platform. Math.Round would take 24.5 to 24.</summary>
    private const double RoundHalfUpOffset = 0.5;

    private const double MinLevelTenths = 10;
    private const double MaxLevelTenths = 50;

    private const int SilverMinLevelTenths = 25;
    private const int GoldMinLevelTenths = 35;
    private const int EliteMinLevelTenths = 45;

    private static readonly Error InvalidRating = new("invalid-rating", ErrorKind.Validation);

    public static Result<PlayerCardLevel> FromRating(double rating)
    {
        if (!double.IsFinite(rating))
        {
            return Result.Failure<PlayerCardLevel>(InvalidRating);
        }

        var levelTenths = LevelTenthsFromRating(rating);
        return Result.Success(new PlayerCardLevel(levelTenths, TierFromLevelTenths(levelTenths)));
    }

    /// <summary>Clamps while still a double, because an extreme rating does not fit an int.</summary>
    private static int LevelTenthsFromRating(double rating)
    {
        var exactTenths = ((rating - AnchorRating) / RatingPointsPerTenth) + AnchorLevelTenths;
        var roundedTenths = Math.Floor(exactTenths + RoundHalfUpOffset);
        return (int)Math.Min(Math.Max(roundedTenths, MinLevelTenths), MaxLevelTenths);
    }

    private static PlayerCardTier TierFromLevelTenths(int levelTenths)
    {
        if (levelTenths >= EliteMinLevelTenths)
        {
            return PlayerCardTier.Elite;
        }

        if (levelTenths >= GoldMinLevelTenths)
        {
            return PlayerCardTier.Gold;
        }

        return levelTenths >= SilverMinLevelTenths ? PlayerCardTier.Silver : PlayerCardTier.Bronze;
    }
}
