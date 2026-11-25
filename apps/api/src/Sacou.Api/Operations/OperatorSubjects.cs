using System.Collections.Frozen;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Api.Operations;

/// <summary>
/// Who opens the operator's dashboard (E7.2, ADR 0085, D1): the Firebase UIDs of <c>Operations:OperatorSubjects</c>, a
/// comma-separated list that the deploy fills from the GitHub variable <c>SACOU_OPERATOR_UIDS</c> of each environment.
/// Spaces around an item are dropped; an empty list lets nobody in. The comparison is ordinal and exact, as the UID is.
/// Never printed: a UID identifies a person.
/// </summary>
internal sealed class OperatorSubjects
{
    public const string ConfigurationKey = "Operations:OperatorSubjects";

    public static readonly Error Malformed = new("ops.operator-subjects-malformed", ErrorKind.Validation);

    private const char Separator = ',';

    private readonly FrozenSet<string> subjects;

    private OperatorSubjects(FrozenSet<string> subjects) => this.subjects = subjects;

    public static OperatorSubjects None { get; } = new(FrozenSet<string>.Empty);

    public int Count => subjects.Count;

    /// <summary>A missing or blank value is the empty list; any empty item or one out of the UID format refuses the whole list.</summary>
    public static Result<OperatorSubjects> Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return Result.Success(None);
        }

        var items = value.Split(Separator).Select(item => item.Trim()).ToList();
        return items.TrueForAll(AuthSubjects.IsWellFormed)
            ? Result.Success(new OperatorSubjects(items.ToFrozenSet(StringComparer.Ordinal)))
            : Result.Failure<OperatorSubjects>(Malformed);
    }

    public bool Contains(string? subject) => subject is not null && subjects.Contains(subject);

    /// <summary>Never the UIDs.</summary>
    public override string ToString() => nameof(OperatorSubjects);
}
