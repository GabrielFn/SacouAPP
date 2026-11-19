using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// <c>POST /v1/round-links/resolve</c> <c>{ code }</c>: which group and round the link opens, and whether the caller is
/// already an active member there (ADR 0070, D3). No name, no count, nothing about anyone: a member reads the rest
/// through the group routes, with their usual authorization. The code travels in the body, never in this route.
/// </summary>
internal static class ResolveRoundLinkEndpoint
{
    public const string Name = "ResolveRoundLink";
    public const string Route = RoundLinkRoutes.Prefix + "/resolve";

    public static IEndpointRouteBuilder MapResolveRoundLink(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapRoundLinkPost(Route, HandleAsync, Name);
        return endpoints;
    }

    private static async Task<Results<Ok<ResolvedRoundLinkResponse>, ProblemHttpResult>> HandleAsync(
        RoundLinkRequest request, ResolveRoundLinkHandler handler, CancellationToken cancellationToken)
    {
        var resolved = await handler.HandleAsync(request.Code, cancellationToken).ConfigureAwait(false);
        return resolved.ToHttpResult(body => TypedResults.Ok(body));
    }
}

/// <summary>Only the code: a field the record does not declare is a 400 (ADR 0039).</summary>
internal sealed record RoundLinkRequest(string? Code)
{
    public override string ToString() => nameof(RoundLinkRequest);
}

internal sealed record ResolvedRoundLinkResponse(Guid GroupId, Guid RoundId, bool IsMember);

internal sealed class ResolveRoundLinkHandler(ICurrentUser currentUser, RoundLinkReader reader, IGroupMembership membership)
{
    public async Task<Result<ResolvedRoundLinkResponse>> HandleAsync(string? code, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<ResolvedRoundLinkResponse>(user.Error);
        }

        var round = await reader.FindAsync(code, cancellationToken).ConfigureAwait(false);
        if (round.IsFailure)
        {
            return Result.Failure<ResolvedRoundLinkResponse>(round.Error);
        }

        var group = round.Value.GroupId.Value;
        var member = await membership.FindActiveAsync(group, user.Value.UserId, cancellationToken).ConfigureAwait(false);
        return Result.Success(new ResolvedRoundLinkResponse(group, round.Value.Id.Value, IsMember: member is not null));
    }
}
