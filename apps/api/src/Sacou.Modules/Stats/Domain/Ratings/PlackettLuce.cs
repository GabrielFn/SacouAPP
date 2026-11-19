using System.Collections.Immutable;

namespace Sacou.Modules.Stats.Domain.Ratings;

/// <summary>The two teams of a match after it was rated, winner first.</summary>
internal sealed record RatedTeams(ImmutableArray<Skill> Winners, ImmutableArray<Skill> Losers);

/// <summary>
/// Port of the Plackett-Luce model of <c>openskill</c> 5.0.1 (Weng-Lin), only what one match of two teams
/// uses: <c>rate()</c> with a winner and a loser (ranks 1 and 2), <c>beta</c>, <c>tau</c>, <c>kappa</c>,
/// <c>limitSigma</c>, <c>balance</c> off and γ = √σ²ᵢ / c. A draw never reaches it (rule 18). The operations
/// keep the order of the library, so the numbers match TypeScript to the last bit or two (golden
/// <c>openskill-plackett-luce.json</c>, relative tolerance 1e-9 for <c>Math.Exp</c>).
/// </summary>
internal static class PlackettLuce
{
    public static RatedTeams Rate(RatingParams parameters, ImmutableArray<Skill> winners, ImmutableArray<Skill> losers)
    {
        var tauSquared = parameters.Tau * parameters.Tau;
        ImmutableArray<ImmutableArray<Skill>> widened = [Widen(winners, tauSquared), Widen(losers, tauSquared)];
        var rated = Model(parameters, widened);
        return parameters.Tau != 0 && parameters.LimitSigma
            ? new RatedTeams(Limit(rated[0], winners), Limit(rated[1], losers))
            : new RatedTeams(rated[0], rated[1]);
    }

    /// <summary>σ grows by τ before the match, so a rating never freezes.</summary>
    private static ImmutableArray<Skill> Widen(ImmutableArray<Skill> team, double tauSquared) =>
        [.. team.Select(skill => skill with { Sigma = Math.Sqrt((skill.Sigma * skill.Sigma) + tauSquared) })];

    /// <summary>With <c>limitSigma</c>, a match never ends with a σ above the one before τ.</summary>
    private static ImmutableArray<Skill> Limit(ImmutableArray<Skill> rated, ImmutableArray<Skill> before) =>
        [.. rated.Select((skill, index) => skill with { Sigma = Math.Min(skill.Sigma, before[index].Sigma) })];

    /// <summary>
    /// The model on teams in rank order, each rank distinct (the rank of a team is its index), so every
    /// <c>a[q]</c> of the library is 1.
    /// </summary>
    private static ImmutableArray<ImmutableArray<Skill>> Model(RatingParams parameters, ImmutableArray<ImmutableArray<Skill>> teams)
    {
        var betaSquared = parameters.Beta * parameters.Beta;
        ImmutableArray<TeamRating> ratings = [.. teams.Select(TeamRatingOf)];
        var c = Math.Sqrt(ratings.Aggregate(0.0, (total, rating) => total + (rating.SigmaSquared + betaSquared)));
        ImmutableArray<double> sumQ = [.. ratings.Select((_, q) => ratings.Skip(q).Aggregate(0.0, (total, rating) => total + Math.Exp(rating.Mu / c)))];
        return [.. ratings.Select((rating, i) => RateTeam(parameters, rating, i, c, sumQ))];
    }

    private static ImmutableArray<Skill> RateTeam(RatingParams parameters, TeamRating rating, int i, double c, ImmutableArray<double> sumQ)
    {
        var muOverCe = Math.Exp(rating.Mu / c);
        var omegaSum = 0.0;
        var deltaSum = 0.0;
        for (var q = 0; q <= i; q++)
        {
            var quotient = muOverCe / sumQ[q];
            omegaSum += i == q ? 1 - quotient : -quotient;
            deltaSum += quotient * (1 - quotient);
        }

        var gamma = Math.Sqrt(rating.SigmaSquared) / c;
        var omega = omegaSum * (rating.SigmaSquared / c);
        var delta = deltaSum * (rating.SigmaSquared / (c * c)) * gamma;
        return [.. rating.Team.Select(skill =>
        {
            var share = skill.Sigma * skill.Sigma / rating.SigmaSquared;
            return new Skill(
                skill.Mu + (share * omega),
                skill.Sigma * Math.Sqrt(Math.Max(1 - (share * delta), parameters.Kappa)));
        })];
    }

    private static TeamRating TeamRatingOf(ImmutableArray<Skill> team) =>
        new(
            team.Aggregate(0.0, (total, skill) => total + skill.Mu),
            team.Aggregate(0.0, (total, skill) => total + (skill.Sigma * skill.Sigma)),
            team);

    /// <summary>The sums of a team: μ and σ² of its players.</summary>
    private sealed record TeamRating(double Mu, double SigmaSquared, ImmutableArray<Skill> Team);
}
