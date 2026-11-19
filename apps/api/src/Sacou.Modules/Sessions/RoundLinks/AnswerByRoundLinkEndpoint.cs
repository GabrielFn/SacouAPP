using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Sessions.Domain.Attendances;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// <c>POST /v1/round-links/attendance</c> <c>{ code, response }</c>: the caller's own "vou" or "não vou" through the
/// round's link, coming into the group as an avulso first when they are not in it (ADR 0070, D2), recorded with the
/// <c>web</c> channel. 200 with where the caller stands. A refusal of the answer after the group step carries
/// <c>joined</c>: whoever came in stays in the group even when the answer is refused (the avulsos' window, a full round).
/// Holds two connections when it joins, like the invite acceptance, so it shares their concurrency gate (ADR 0062, D5).
/// </summary>
internal static class AnswerByRoundLinkEndpoint
{
    public const string Name = "AnswerByRoundLink";
    public const string Route = RoundLinkRoutes.Prefix + "/attendance";

    /// <summary>The extension of a refusal that says whether the caller came into the group before it.</summary>
    public const string JoinedExtension = "joined";

    public static IEndpointRouteBuilder MapAnswerByRoundLink(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapRoundLinkPost(Route, HandleAsync, Name).ProducesProblem(StatusCodes.Status409Conflict);
        return endpoints;
    }

    private static async Task<Results<Ok<RoundLinkAnswerResponse>, ProblemHttpResult>> HandleAsync(
        RoundLinkAnswerRequest request, AnswerByRoundLinkHandler handler, CancellationToken cancellationToken)
    {
        var attempt = await handler.HandleAsync(request.Code, request.Response, cancellationToken).ConfigureAwait(false);
        if (attempt.Answer.IsSuccess)
        {
            return TypedResults.Ok(attempt.Answer.Value);
        }

        return attempt.Joined is { } joined
            ? ProblemResults.From(attempt.Answer.Error, new Dictionary<string, object?> { [JoinedExtension] = joined })
            : ProblemResults.From(attempt.Answer.Error);
    }
}

/// <summary>The code and the answer, both required: an absent or unknown answer is a 400, never a default "vou".</summary>
internal sealed record RoundLinkAnswerRequest(string? Code, [property: JsonRequired] AttendanceResponse Response)
{
    public override string ToString() => nameof(RoundLinkAnswerRequest);
}

/// <summary>Where the caller stands after the answer: their own ids and place only, and whether this call put them in the group.</summary>
internal sealed record RoundLinkAnswerResponse(Guid GroupId, Guid RoundId, Guid MemberId, bool Joined, AttendanceStatus Status, int? Position);
