using System.Collections.Immutable;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>
/// A refusal of the reader or of the rules as a <see cref="CourtProblem"/>. Only the details the error carries, each
/// already a schema field, an index, an event id the parser proved, a code or a number (ADR 0060, D15). A refused
/// former writer learns the current batch and its own last sequence; anyone else only the batch (ADR 0063, D8).
/// </summary>
internal static class CourtProblems
{
    public static CourtProblem From(EventBatchError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        var extensions = ImmutableDictionary.CreateBuilder<string, object?>(StringComparer.Ordinal);
        AddIfPresent(extensions, CourtProblem.FieldExtension, error.Field);
        AddIfPresent(extensions, CourtProblem.IndexExtension, error.Index);
        return new CourtProblem(CourtErrors.Of(error), extensions.ToImmutable());
    }

    public static CourtProblem From(CourtWriteError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        var extensions = ImmutableDictionary.CreateBuilder<string, object?>(StringComparer.Ordinal);
        AddIfPresent(extensions, CourtProblem.EventIdExtension, error.EventId);
        AddIfPresent(extensions, CourtProblem.ReasonExtension, error.Reason);
        AddIfPresent(extensions, CourtProblem.ExpectedSequenceExtension, error.ExpectedSequence);
        AddIfPresent(extensions, CourtProblem.LimitExtension, error.Limit);
        AddIfPresent(extensions, CourtProblem.CurrentBatchExtension, error.CurrentBatch);
        AddIfPresent(extensions, CourtProblem.LastSequenceExtension, error.LastSequence);
        AddIfPresent(extensions, CourtProblem.FieldExtension, error.Field);
        return new CourtProblem(CourtErrors.Of(error.Code), extensions.ToImmutable());
    }

    private static void AddIfPresent(ImmutableDictionary<string, object?>.Builder extensions, string key, object? value)
    {
        if (value is not null)
        {
            extensions.Add(key, value);
        }
    }
}
