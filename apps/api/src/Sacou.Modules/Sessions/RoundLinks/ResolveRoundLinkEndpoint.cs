using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// <c>POST /v1/round-links/resolve</c> <c>{ code }</c>: whether the round is still open, which group and round the link
/// opens while it is, and whether the caller is already an active member there (ADR 0070, D3). No name, no count, nothing
/// about anyone: a member reads the rest through the group routes, with their usual authorization. The code travels in
/// the body, never in this route.
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
