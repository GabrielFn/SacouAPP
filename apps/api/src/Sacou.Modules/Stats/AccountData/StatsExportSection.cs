using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Stats.GetMyStats;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Modules.Stats.Projections;

namespace Sacou.Modules.Stats.AccountData;

/// <summary>
/// "Estatísticas" of the export (pendência 95, ADR 0071): the person's round of each round they played, in any group
/// they have or had a member in, oldest group first and in play order. "Foi MVP" is the MVP after the vote (ADR 0072, D11). <b>Never the hidden rating nor the admin's
/// grade</b> (the precedent of question 42; the access right to the derived rating goes to E6.2). On deletion
/// nothing is erased here: every row points to a <c>MemberId</c>, and the former member stays in the others' sums.
/// </summary>
internal sealed class StatsExportSection(IUserMemberships memberships, StatsProjector projector, MvpOutcomes outcomes) : IAccountExportSection
{
    public string Name => AccountExportSections.Stats;

    public int Order => AccountExportSections.StatsOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var found = await memberships.ListAsync(userId, cancellationToken).ConfigureAwait(false);
        var entries = new List<StatsExportEntry>();
        foreach (var membership in found)
        {
            var rounds = await projector.ListRoundsAsync(membership.GroupId, cancellationToken).ConfigureAwait(false);
            var votes = await outcomes.OfRoundsAsync(membership.GroupId, rounds, cancellationToken).ConfigureAwait(false);
            var group = new MembershipRounds(membership, rounds, votes);
            entries.AddRange(rounds.SelectMany(round => EntriesOf(group, round)));
        }

        return entries;
    }

    private static IEnumerable<StatsExportEntry> EntriesOf(MembershipRounds group, RoundProjection round)
    {
        var membership = group.Membership;
        return round.Summary.Players
            .Where(player => player.MemberId == membership.MemberId)
            .Select(player => new StatsExportEntry(
                membership.GroupId,
                round.Facts.RoundId,
                round.Facts.LocalDate,
                round.Counts,
                player.MatchesPlayed,
                player.Wins,
                player.Losses,
                player.Undecided,
                player.PlusMinus,
                player.LongestWinStreak,
                new StatsExportPoints(player.PointsByKind.Attack, player.PointsByKind.Block, player.PointsByKind.Ace, player.PointsByKind.Other),
                group.WasMvp(round, membership.MemberId)));
    }
}

/// <summary>One round of the person: <see cref="Counts"/> is false for a canceled round, which is in no sum (rule 3.6).</summary>
internal sealed record StatsExportEntry(
    Guid GroupId,
    Guid RoundId,
    DateOnly Date,
    bool Counts,
    int MatchesPlayed,
    int Wins,
    int Losses,
    int Undecided,
    int PlusMinus,
    int LongestWinStreak,
    StatsExportPoints PointsByKind,
    bool WasMvp);

internal sealed record StatsExportPoints(int Attack, int Block, int Ace, int Other);
