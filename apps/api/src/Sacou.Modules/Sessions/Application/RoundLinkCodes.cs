using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Application;

/// <summary>A round the store was asked to insert, with the link code it went in with, and whether this call inserted it.</summary>
internal sealed record AddedRound(Round Round, bool Inserted);

/// <summary>
/// Every round gets its link code here (ADR 0070, D1): on creation, on the materialization of a series, and on an
/// admin's first read of a round made before the link existed. A code that is already another round's is drawn again
/// once; a second clash in a row means a broken generator, and is a 500.
/// </summary>
internal sealed class RoundLinkCodes(IRoundStore store, IRoundLinkCodeGenerator generator)
{
    private const int Attempts = 2;

    public async Task<Result<AddedRound>> AddAsync(NewRound added, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(added);
        for (var attempt = 0; attempt < Attempts; attempt++)
        {
            var coded = added with { Change = added.Change with { Round = added.Change.Round.WithLinkCode(generator.NewCode()) } };
            var stored = await store.AddAsync(coded, cancellationToken).ConfigureAwait(false);
            if (stored.IsFailure && stored.Error == RoundLinkCodeErrors.Taken)
            {
                continue;
            }

            return stored.IsFailure
                ? Result.Failure<AddedRound>(stored.Error)
                : Result.Success(new AddedRound(coded.Change.Round, stored.Value));
        }

        throw new InvalidOperationException("Two new round link codes in a row were already taken.");
    }

    /// <summary>The round with its code: as it is, or with one given now when it has none.</summary>
    public async Task<Result<Round>> EnsureAsync(Round round, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(round);
        if (round.LinkCode is not null)
        {
            return Result.Success(round);
        }

        for (var attempt = 0; attempt < Attempts; attempt++)
        {
            var assigned = await store.AssignLinkCodeAsync(round.GroupId, round.Id, generator.NewCode(), cancellationToken).ConfigureAwait(false);
            if (assigned.IsFailure && assigned.Error == RoundLinkCodeErrors.Taken)
            {
                continue;
            }

            return assigned.IsFailure ? Result.Failure<Round>(assigned.Error) : Result.Success(round.WithLinkCode(assigned.Value));
        }

        throw new InvalidOperationException("Two new round link codes in a row were already taken.");
    }
}
