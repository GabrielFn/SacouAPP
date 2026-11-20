using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Shared.Members;

namespace Sacou.Modules.Stats.AccountData;

/// <summary>
/// "Votos do MVP" of the export (ADR 0072, D7): the votes the person gave, in any group they have or had a member in,
/// oldest group first and oldest vote first ("seu voto"). <b>Never a vote someone else gave</b>, not even one for the
/// person. On deletion nothing is erased: the vote points to a <c>MemberId</c> and still counts in its round.
/// </summary>
internal sealed class MvpVotesExportSection(IUserMemberships memberships, IMvpVoteStore votes) : IAccountExportSection
{
    public string Name => AccountExportSections.MvpVotes;

    public int Order => AccountExportSections.MvpVotesOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var found = await memberships.ListAsync(userId, cancellationToken).ConfigureAwait(false);
        var entries = new List<MvpVoteExportEntry>();
        foreach (var membership in found)
        {
            var given = await votes.ListGivenAsync(membership.GroupId, new MemberId(membership.MemberId), cancellationToken).ConfigureAwait(false);
            entries.AddRange(given.Select(vote => new MvpVoteExportEntry(membership.GroupId, vote.RoundId, vote.Candidate.Value, vote.CastAt)));
        }

        return entries;
    }
}

/// <summary>One vote of the person: whom they voted for in which round, and when.</summary>
internal sealed record MvpVoteExportEntry(Guid GroupId, Guid RoundId, Guid CandidateMemberId, DateTimeOffset CastAt);
