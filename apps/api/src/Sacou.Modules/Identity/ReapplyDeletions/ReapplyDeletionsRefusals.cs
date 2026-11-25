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
}
