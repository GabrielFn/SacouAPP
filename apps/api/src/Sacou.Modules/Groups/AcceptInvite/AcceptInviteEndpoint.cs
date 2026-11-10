using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;

namespace Sacou.Modules.Groups.AcceptInvite;

/// <summary>
/// <c>POST /v1/invites/accept</c> <c>{ token }</c>: 201 <c>{ groupId, memberId }</c> for who came in (new or
/// back), 200 with the same body for who was in already. The token travels in the body, never the URL; the
/// public link carries it after the <c>#</c> (E4.16), which no browser sends to a server.
/// </summary>
internal static class AcceptInviteEndpoint
{
    public const string Name = "AcceptInvite";
    public const string Route = GroupRouteExtensions.InvitesRoute + "/accept";

    public static IEndpointRouteBuilder MapAcceptInvite(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(Route, HandleAsync).WithName(Name).WithMetadata(GroupRouteExtensions.SmallBody())
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return endpoints;
    }

    private static async Task<Results<Created<AcceptInviteResponse>, Ok<AcceptInviteResponse>, ProblemHttpResult>> HandleAsync(
        AcceptInviteRequest request, AcceptInviteHandler handler, CancellationToken cancellationToken)
    {
        var accepted = await handler.HandleAsync(request.Token, cancellationToken).ConfigureAwait(false);
        return accepted.Match<Results<Created<AcceptInviteResponse>, Ok<AcceptInviteResponse>, ProblemHttpResult>>(
            value => value.Joined
                ? TypedResults.Created($"{GroupRouteExtensions.GroupsRoute}/{value.GroupId}", AcceptInviteResponse.From(value))
                : TypedResults.Ok(AcceptInviteResponse.From(value)),
            error => ProblemResults.From(error));
    }
}

/// <summary>Only the token: a field the record does not declare is a 400 (ADR 0039).</summary>
internal sealed record AcceptInviteRequest(string? Token)
{
    public override string ToString() => nameof(AcceptInviteRequest);
}

internal sealed record AcceptInviteResponse(Guid GroupId, Guid MemberId)
{
    public static AcceptInviteResponse From(AcceptedInvite accepted) => new(accepted.GroupId, accepted.MemberId);
}
