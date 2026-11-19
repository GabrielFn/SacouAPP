using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>
/// A store answer that never reaches a client: the new link code is already another round's. The caller draws
/// another code and tries once more (<c>RoundLinkCodes</c>); two in a row is a 500. Not an <c>*Errors</c> class on
/// purpose: the OpenAPI catalog of error codes lists only those, and this code is never an answer.
/// </summary>
internal static class RoundLinkCodeClash
{
    public static readonly Error Taken = new("sessions.round-link-code-taken", ErrorKind.Conflict);
}
