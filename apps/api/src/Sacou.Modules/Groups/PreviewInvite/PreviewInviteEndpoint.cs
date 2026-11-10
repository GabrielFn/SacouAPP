using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;

namespace Sacou.Modules.Groups.PreviewInvite;

/// <summary>
/// <c>POST /v1/invites/preview</c> <c>{ token }</c>. A POST, so the token travels in the body: hosting and
/// Railway logs keep the path and the query, never the body. Outside the group filter, on the closed list.
/// </summary>
internal static class PreviewInviteEndpoint
{
    public const string Name = "PreviewInvite";
    public const string Route = GroupRouteExtensions.InvitesRoute + "/preview";

    public static IEndpointRouteBuilder MapPreviewInvite(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(Route, HandleAsync).WithName(Name).WithMetadata(GroupRouteExtensions.SmallBody())
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);
        return endpoints;
    }

    private static async Task<Results<Ok<PreviewInviteResponse>, ProblemHttpResult>> HandleAsync(
        PreviewInviteRequest request, PreviewInviteHandler handler, CancellationToken cancellationToken)
    {
        var preview = await handler.HandleAsync(request.Token, cancellationToken).ConfigureAwait(false);
        return preview.ToHttpResult(body => TypedResults.Ok(body));
    }
}

/// <summary>Only the token: a field the record does not declare is a 400 (ADR 0039).</summary>
internal sealed record PreviewInviteRequest(string? Token)
{
    public override string ToString() => nameof(PreviewInviteRequest);
}
