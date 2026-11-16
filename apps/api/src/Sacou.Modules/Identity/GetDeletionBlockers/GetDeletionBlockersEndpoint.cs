using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;

namespace Sacou.Modules.Identity.GetDeletionBlockers;

/// <summary>
/// <c>GET /v1/me/deletion-blockers</c> (E3.16, ADR 0056, D10): what screen 30b shows before the person may delete
/// the account; an empty list when nothing blocks. Only a preview: the delete of part 2 decides again under the locks.
/// </summary>
internal static class GetDeletionBlockersEndpoint
{
    public const string Route = "/v1/me/deletion-blockers";
    public const string Name = "GetDeletionBlockers";

    public static IEndpointRouteBuilder MapGetDeletionBlockers(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(Route, HandleAsync).WithName(Name).RequireAuthorization().WithNoStore()
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    private static async Task<Results<Ok<DeletionBlockersResponse>, ProblemHttpResult>> HandleAsync(
        HttpContext context, GetDeletionBlockersHandler handler, CancellationToken cancellationToken)
    {
        var found = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        return found.ToHttpResult(TypedResults.Ok);
    }
}
