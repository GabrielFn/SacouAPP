namespace Sacou.Modules.Stats.Domain.Ratings;

/// <summary>
/// The parameters of the hidden rating, versioned in <c>packages/rating/src/rating-params.json</c> (ADR 0071,
/// rule 24 of the statistics), the file TypeScript reads and this assembly embeds. Every value goes to the
/// model explicitly; nothing depends on a default of the library.
/// </summary>
/// <param name="RatingParamsVersion">Bumped with any change; the projections then rebuild every pool.</param>
/// <param name="Mu0">μ of level 3.0.</param>
/// <param name="LevelStep">μ for one level (1.0) above or below 3.0 (ADR 0018).</param>
/// <param name="SigmaAdmin">σ of a seed the admin confirmed.</param>
/// <param name="SigmaUnconfirmed">σ of a suggested or default seed.</param>
/// <param name="Beta">Performance noise of a player.</param>
/// <param name="Tau">Added to σ before each match, so it never freezes.</param>
/// <param name="Kappa">Floor of the σ shrink factor.</param>
/// <param name="LimitSigma">With <see cref="Tau"/>, a match never raises σ.</param>
internal sealed record RatingParams(
    int RatingParamsVersion,
    double Mu0,
    double LevelStep,
    double SigmaAdmin,
    double SigmaUnconfirmed,
    double Beta,
    double Tau,
    double Kappa,
    bool LimitSigma)
{
    /// <summary>The version this port was written and checked against; a test compares it with the shared file.</summary>
    public const int SupportedVersion = 1;
}

/// <summary>The skill of a member in a pool: mean and uncertainty of Weng-Lin.</summary>
internal readonly record struct Skill(double Mu, double Sigma);
