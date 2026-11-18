using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.SignIn;

/// <summary>
/// <c>POST /v1/me</c>, no body: 201 when this call created the user, 200 when it already existed, 410
/// <c>identity.account-deleted</c> when this login's account was deleted (ADR 0056, D5).
/// </summary>
internal static class SignInEndpoint
{
    public const string Route = "/v1/me";
    public const string Name = "SignIn";

    public static IEndpointRouteBuilder MapSignIn(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(Route, HandleAsync).WithName(Name).RequireRateLimiting(RateLimitPolicies.SignIn).RequireAuthorization()
            .ProducesProblem(StatusCodes.Status410Gone);
        return endpoints;
    }

    private static async Task<Results<Created<SignInResponse>, Ok<SignInResponse>, UnauthorizedHttpResult, ProblemHttpResult>> HandleAsync(
        ClaimsPrincipal principal, SignInHandler handler, CancellationToken cancellationToken)
    {
        var subject = AuthSubject.Create(principal.FindFirstValue(ClaimTypes.NameIdentifier));
        if (subject.IsFailure)
        {
            return TypedResults.Unauthorized();
        }

        var outcome = await handler.HandleAsync(subject.Value, cancellationToken).ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return ProblemResults.From(outcome.Error);
        }

        var response = new SignInResponse(outcome.Value.UserId.Value);
        return outcome.Value.Created ? TypedResults.Created(Route, response) : TypedResults.Ok(response);
    }
}
