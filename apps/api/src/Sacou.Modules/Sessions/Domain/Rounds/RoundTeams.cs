using System.Collections.Immutable;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>The numbers of the published teams (ADR 0078).</summary>
internal static class RoundTeamsLimits
{
    /// <summary>"Quem perde sai" needs at least two teams.</summary>
    public const int MinTeams = 2;

    /// <summary>Two players: the smallest team of a draw (two teams of two, docs/dominio/sorteio.md).</summary>
    public const int MinTeamSize = 2;

    /// <summary>
    /// Ids in one confirmation, teams and reserves together: above what the round body holds (about 130 ids in
    /// <c>RoundRouteExtensions.MaxBodyBytes</c>), so it only guards a gap, never a real racha.
    /// </summary>
    public const int MaxPlayers = 160;
}

/// <summary>
/// The teams the admin confirmed on screen 07 ("Confirmar e compartilhar"), as every member of the group reads them
/// (ADR 0078). Only <see cref="MemberId"/>s, in order: the teams as drawn (1 is Laranja, 2 is Azul) and the reserves in
/// the order of the queue. Never a level, an average, a difference or a seed: the draw keeps those to the admin.
/// A photo of the draw: nothing changes it but another confirmation, which replaces it whole.
/// </summary>
internal sealed record RoundTeams(ImmutableArray<ImmutableArray<MemberId>> Teams, ImmutableArray<MemberId> Reserves, DateTimeOffset ConfirmedAt)
{
    /// <summary>Every id, the teams in order and then the reserves.</summary>
    public IEnumerable<MemberId> Everyone => Teams.SelectMany(team => team).Concat(Reserves);

    /// <summary>
    /// The teams, when they follow the rule: from <see cref="RoundTeamsLimits.MinTeams"/> teams, all of the same size,
    /// from <see cref="RoundTeamsLimits.MinTeamSize"/> to the modality's team (<see cref="TeamsEligibility.PlayersPerTeam"/>);
    /// nobody twice; and everyone, reserves included, confirmed in the round and active in the group
    /// (<paramref name="eligibility"/>). Any other shape is <see cref="RoundErrors.RoundTeamsInvalid"/>.
    /// </summary>
    public static Result<RoundTeams> Create(
        ImmutableArray<ImmutableArray<MemberId>> teams,
        ImmutableArray<MemberId> reserves,
        TeamsEligibility eligibility,
        DateTimeOffset confirmedAt)
    {
        ArgumentNullException.ThrowIfNull(eligibility);
        var candidate = new RoundTeams(teams, reserves, confirmedAt);
        return candidate.HasValidShape(eligibility.PlayersPerTeam) && candidate.AllEligible(eligibility)
            ? Result.Success(candidate)
            : Result.Failure<RoundTeams>(RoundErrors.RoundTeamsInvalid);
    }

    private bool HasValidShape(int playersPerTeam)
    {
        if (Teams.IsDefault || Reserves.IsDefault || Teams.Length < RoundTeamsLimits.MinTeams || Teams.Any(team => team.IsDefault))
        {
            return false;
        }

        var size = Teams[0].Length;
        var total = (Teams.Length * size) + Reserves.Length;
        return size >= RoundTeamsLimits.MinTeamSize
            && size <= playersPerTeam
            && Teams.All(team => team.Length == size)
            && total <= RoundTeamsLimits.MaxPlayers;
    }

    private bool AllEligible(TeamsEligibility eligibility)
    {
        var everyone = Everyone.ToImmutableArray();
        return everyone.Distinct().Count() == everyone.Length && everyone.All(eligibility.MayPlay);
    }

    /// <summary>Ids only, but a list of who plays with whom: never printed.</summary>
    public override string ToString() => nameof(RoundTeams);
}

/// <summary>Who may be in the published teams: confirmed in the round and active in the group, and the modality's team size.</summary>
internal sealed record TeamsEligibility(IReadOnlySet<MemberId> Confirmed, IReadOnlySet<MemberId> Active, int PlayersPerTeam)
{
    public bool MayPlay(MemberId member) => Confirmed.Contains(member) && Active.Contains(member);

    public override string ToString() => nameof(TeamsEligibility);
}
