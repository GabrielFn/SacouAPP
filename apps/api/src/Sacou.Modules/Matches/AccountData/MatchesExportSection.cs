using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Matches.Infrastructure;

namespace Sacou.Modules.Matches.AccountData;

/// <summary>
/// "Escrita da quadra" of the export (ADR 0060, D16): each batch of a court stream the person wrote, in any group they
/// have or had a member in, oldest first. The member ids come from the Groups contract. The matches and statistics are
/// the E3.9's, which has the projection. On deletion nothing changes here: the rows point to a <c>MemberId</c>.
/// </summary>
internal sealed class MatchesExportSection(IGroupMembership membership, ICourtWriterReader writers) : IAccountExportSection
{
    public string Name => AccountExportSections.CourtWrites;

    public int Order => AccountExportSections.CourtWritesOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var members = await membership.ListMemberIdsOfUserAsync(userId, cancellationToken).ConfigureAwait(false);
        var found = await writers.ListOfMembersAsync(members, cancellationToken).ConfigureAwait(false);
        return found.Select(write => new CourtWriteExportEntry(write.CourtSessionId, write.RoundId, write.Batch, write.DeviceId, write.StartedAt)).ToList();
    }
}

/// <summary>One batch in the export: the stream, its round, the batch, the installation id of the phone and when it started.</summary>
internal sealed record CourtWriteExportEntry(Guid CourtSessionId, Guid RoundId, long Batch, Guid DeviceId, DateTimeOffset StartedAt);
