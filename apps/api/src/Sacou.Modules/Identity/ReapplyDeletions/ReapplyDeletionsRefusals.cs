using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.ReapplyDeletions;

/// <summary>
/// Never an answer of a route: only the operation command reads it. Not an <c>*Errors</c> class, so the catalog of the
/// API's error codes (<c>ErrorCodeCatalog</c>, OpenAPI) leaves it out.
/// </summary>
internal static class ReapplyDeletionsRefusals
{
    public static readonly Error DumpOlderThanRetention = new(DeletionMarkRetention.DumpOlderThanRetentionCode, ErrorKind.Validation);

    public static readonly Error SourceUnreadable = new(ReapplyDeletionsCodes.SourceUnreadable, ErrorKind.Unavailable);

    public static readonly Error SourceCanWrite = new(ReapplyDeletionsCodes.SourceCanWrite, ErrorKind.Validation);

    public static readonly Error SourceIsTarget = new(ReapplyDeletionsCodes.SourceIsTarget, ErrorKind.Validation);

    public static readonly Error TargetAheadOfSource = new(ReapplyDeletionsCodes.TargetAheadOfSource, ErrorKind.Conflict);

    public static readonly Error Interrupted = new(ReapplyDeletionsCodes.Interrupted, ErrorKind.Unavailable);
}
