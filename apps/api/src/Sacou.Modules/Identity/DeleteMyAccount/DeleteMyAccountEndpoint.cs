using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Identity.Domain.Accounts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.DeleteMyAccount;

/// <summary>
/// <c>DELETE /v1/me</c> (E3.16, ADR 0056, D4 and D7), no body: 204, also when repeated; 403
/// <c>identity.recent-login-required</c> for a sign-in older than five minutes; 409 <c>identity.deletion-blocked</c>
/// with the <c>groupIds</c> to hand over first. The "type EXCLUIR" confirmation is the app's. Never cached.
/// </summary>
internal static class DeleteMyAccountEndpoint
{
    public const string Route = "/v1/me";
    public const string Name = "DeleteMyAccount";
    public const string GroupIdsExtension = "groupIds";

    /// <summary>A body on the delete is refused, not ignored (ADR 0039: what the route does not declare is a 400).</summary>
    public static readonly Error BodyNotAllowed = new("identity.body-not-allowed", ErrorKind.Validation);

    public static IEndpointRouteBuilder MapDeleteMyAccount(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapDelete(Route, HandleAsync).WithName(Name).RequireAuthorization().WithNoStore()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return endpoints;
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        HttpContext context, ClaimsPrincipal principal, DeleteMyAccountHandler handler, CancellationToken cancellationToken)
    {
        if (HasBody(context.Request))
        {
            return ProblemResults.From(BodyNotAllowed);
        }

        var deletion = await handler.HandleAsync(principal, cancellationToken).ConfigureAwait(false);
        return deletion.Error switch
        {
            null => TypedResults.NoContent(),
            var error when error == AccountErrors.DeletionBlocked => ProblemResults.From(
                error, new Dictionary<string, object?> { [GroupIdsExtension] = deletion.BlockingGroupIds }),
            var error => ProblemResults.From(error),
        };
    }

    private static bool HasBody(HttpRequest request) =>
        request.ContentLength is > 0 || request.Headers.TransferEncoding.Count > 0;
}
