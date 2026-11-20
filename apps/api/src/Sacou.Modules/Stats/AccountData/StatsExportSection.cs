using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Stats.Projections;

namespace Sacou.Modules.Stats.AccountData;

/// <summary>
/// "Estatísticas" of the export (pendência 95, ADR 0071): the person's round of each round they played, in any group
/// they have or had a member in, oldest group first and in play order. <b>Never the hidden rating nor the admin's
/// grade</b> (the precedent of question 42; the access right to the derived rating goes to E6.2). On deletion
/// nothing is erased here: every row points to a <c>MemberId</c>, and the former member stays in the others' sums.
/// </summary>
internal sealed class StatsExportSection(IUserMemberships memberships, StatsProjector projector) : IAccountExportSection
{
    public string Name => AccountExportSections.Stats;

    public int Order => AccountExportSections.StatsOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var found = await memberships.ListAsync(userId, cancellationToken).ConfigureAwait(false);
        var entries = new List<StatsExportEntry>();
        foreach (var membership in found)
        {
            var rounds = await projector.GetGroupAsync(membership.GroupId, cancellationToken).ConfigureAwait(false);
            entries.AddRange(rounds.SelectMany(round => EntriesOf(membership, round)));
        }

        return entries;
    }

    private static IEnumerable<StatsExportEntry> EntriesOf(UserMembership membership, RoundProjection round) =>
        round.Summary.Players
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
                round.Summary.Mvp?.MemberIds.Contains(membership.MemberId) == true));
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
