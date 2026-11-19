using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// The round of a link code, without a lock and without a repair (ADR 0070, D1). A malformed code is refused before
/// any query, and it gets the very answer of a code that found no round: <c>sessions.round-link-invalid</c> (404).
/// </summary>
internal sealed class RoundLinkReader(IRoundStore store)
{
    public async Task<Result<Round>> FindAsync(string? code, CancellationToken cancellationToken)
    {
        var parsed = RoundLinkCode.TryParse(code);
        if (parsed is null)
        {
            return Result.Failure<Round>(RoundErrors.RoundLinkInvalid);
        }

        var round = await store.FindByLinkCodeAsync(parsed, cancellationToken).ConfigureAwait(false);
        return round is null ? Result.Failure<Round>(RoundErrors.RoundLinkInvalid) : Result.Success(round);
    }
}
