using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Shared.Members;

namespace Sacou.Modules.Stats.Infrastructure;

/// <summary>
/// A row of <c>stats.mvp_votes</c>: one vote per member per round, by <c>MemberId</c> only (ADR 0072, D8). The pair
/// stays for the person's own vote, the export and the count; only the routes keep it secret, so it never goes to a log.
/// </summary>
internal sealed class MvpVoteRow
{
    public required Guid RoundId { get; init; }

    public required Guid VoterMemberId { get; init; }

    public required Guid GroupId { get; init; }

    public required Guid CandidateMemberId { get; init; }

    public required DateTimeOffset CastAt { get; init; }

    public override string ToString() => nameof(MvpVoteRow);
}

/// <summary>
/// <c>stats.mvp_votes</c>: the key <c>(round_id, voter_member_id)</c> makes a second vote, even a racing one, one row
/// (D9); the CHECK refuses a vote for oneself even from a direct insert. No foreign key to another module (ADR 0037).
/// </summary>
internal sealed class MvpVoteConfiguration : IEntityTypeConfiguration<MvpVoteRow>
{
    public const string Table = "mvp_votes";

    public void Configure(EntityTypeBuilder<MvpVoteRow> builder)
    {
        builder.ToTable(Table, table => table.HasCheckConstraint("ck_mvp_votes_not_self", "voter_member_id <> candidate_member_id"));
        builder.HasKey(row => new { row.RoundId, row.VoterMemberId }).HasName("pk_mvp_votes");
        builder.Property(row => row.RoundId).HasColumnName("round_id").ValueGeneratedNever();
        builder.Property(row => row.VoterMemberId).HasColumnName("voter_member_id").ValueGeneratedNever();
        builder.Property(row => row.GroupId).HasColumnName("group_id");
        builder.Property(row => row.CandidateMemberId).HasColumnName("candidate_member_id");
        builder.Property(row => row.CastAt).TimestampColumn("cast_at");

        // The export of an account reads the votes a member gave (E3.16, part 2).
        builder.HasIndex(row => row.VoterMemberId).HasDatabaseName("ix_mvp_votes_voter");
    }
}

/// <summary>The votes of the MVP. Every read is by <c>(groupId, roundId)</c>, never by a bare round id.</summary>
internal interface IMvpVoteStore
{
    /// <summary>Stores the vote unless the voter already has one in the round: false then, and nothing changes (D9).</summary>
    Task<bool> TryCastAsync(Guid groupId, Guid roundId, MvpVote vote, CancellationToken cancellationToken);

    /// <summary>The caller's own vote in the round, or null.</summary>
    Task<MvpVote?> FindMineAsync(Guid groupId, Guid roundId, MemberId voter, CancellationToken cancellationToken);

    /// <summary>Every vote of the round, only for the count inside the Stats: no route returns them.</summary>
    Task<IReadOnlyList<MvpVote>> ListForRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken);

    /// <summary>The votes <paramref name="voter"/> gave in the group, oldest first: only the export reads them (D7).</summary>
    Task<IReadOnlyList<GivenMvpVote>> ListGivenAsync(Guid groupId, MemberId voter, CancellationToken cancellationToken);
}

/// <summary>A vote the person gave, with its round: never a vote someone else gave.</summary>
internal sealed record GivenMvpVote(Guid RoundId, MemberId Candidate, DateTimeOffset CastAt)
{
    public override string ToString() => nameof(GivenMvpVote);
}

/// <summary>SQL is always parameterized: EF turns the interpolated values into parameters (ADR 0037).</summary>
internal sealed class PostgresMvpVoteStore(StatsDbContext database) : IMvpVoteStore
{
    public async Task<bool> TryCastAsync(Guid groupId, Guid roundId, MvpVote vote, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(vote);
        var written = await database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO stats.mvp_votes (round_id, voter_member_id, group_id, candidate_member_id, cast_at)
            VALUES ({roundId}, {vote.Voter.Value}, {groupId}, {vote.Candidate.Value}, {vote.CastAt.ToUniversalTime()})
            ON CONFLICT (round_id, voter_member_id) DO NOTHING
            """, cancellationToken).ConfigureAwait(false);
        return written > 0;
    }

    public async Task<MvpVote?> FindMineAsync(Guid groupId, Guid roundId, MemberId voter, CancellationToken cancellationToken)
    {
        var row = await database.MvpVotes.AsNoTracking()
            .SingleOrDefaultAsync(
                row => row.GroupId == groupId && row.RoundId == roundId && row.VoterMemberId == voter.Value, cancellationToken)
            .ConfigureAwait(false);
        return row is null ? null : ToVote(row);
    }

    public async Task<IReadOnlyList<MvpVote>> ListForRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var rows = await database.MvpVotes.AsNoTracking()
            .Where(row => row.GroupId == groupId && row.RoundId == roundId)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(ToVote)];
    }

    public async Task<IReadOnlyList<GivenMvpVote>> ListGivenAsync(Guid groupId, MemberId voter, CancellationToken cancellationToken)
    {
        var rows = await database.MvpVotes.AsNoTracking()
            .Where(row => row.GroupId == groupId && row.VoterMemberId == voter.Value)
            .OrderBy(row => row.CastAt).ThenBy(row => row.RoundId)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(row => new GivenMvpVote(row.RoundId, new MemberId(row.CandidateMemberId), row.CastAt))];
    }

    private static MvpVote ToVote(MvpVoteRow row) =>
        new(new MemberId(row.VoterMemberId), new MemberId(row.CandidateMemberId), row.CastAt);
}
