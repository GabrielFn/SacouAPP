using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Sacou.Http;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

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

/// <summary>Asks every module that can block (Groups, in the pilot) and joins the answers.</summary>
internal sealed partial class GetDeletionBlockersHandler(
    ICurrentUser currentUser, IEnumerable<IAccountDeletionBlockers> sources, ILogger<GetDeletionBlockersHandler> logger)
{
    public async Task<Result<DeletionBlockersResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<DeletionBlockersResponse>(user.Error);
        }

        var blockers = new List<DeletionBlocker>();
        foreach (var source in sources)
        {
            blockers.AddRange(await source.FindAsync(user.Value.UserId, cancellationToken).ConfigureAwait(false));
        }

        Listed(logger, blockers.Count);
        return Result.Success(DeletionBlockersResponse.From(blockers));
    }

    /// <summary>Only how many groups block, never which (ADR 0056, D11).</summary>
    [LoggerMessage(Level = LogLevel.Information, Message = "Deletion blockers listed: {Groups} groups.")]
    private static partial void Listed(ILogger logger, int groups);
}

/// <summary>The body of <c>GET /v1/me/deletion-blockers</c>, ordered by group name, then id.</summary>
internal sealed record DeletionBlockersResponse(IReadOnlyList<DeletionBlockerResponse> Blockers)
{
    public static DeletionBlockersResponse From(IEnumerable<DeletionBlocker> blockers) => new(
        [.. blockers
            .OrderBy(blocker => blocker.GroupName, StringComparer.Ordinal).ThenBy(blocker => blocker.GroupId)
            .Select(blocker => new DeletionBlockerResponse(blocker.GroupId, blocker.GroupName, blocker.Kind))]);
}

/// <summary>One group to hand over: <c>lastAdmin</c> means "promote someone to admin first" (screen 19).</summary>
internal sealed record DeletionBlockerResponse(Guid GroupId, string GroupName, DeletionBlockerKind Kind);
