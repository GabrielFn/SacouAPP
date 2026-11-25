using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.Extensions.Options;

namespace Sacou.Api.Operations;

/// <summary>
/// <c>Operations</c>: the configuration of the operator's dashboard (E7.2, ADR 0085, D1). Only the list of UIDs, read
/// from <c>Operations__OperatorSubjects</c>; checked on start, so a malformed list never answers.
/// </summary>
internal sealed class OperationsOptions
{
    public const string SectionName = "Operations";

    public string? OperatorSubjects { get; init; }
}

/// <summary>The message names the key and the rule, never the value (it holds UIDs).</summary>
internal sealed class OperationsOptionsValidator : IValidateOptions<OperationsOptions>
{
    public const string Failure =
        OperatorSubjects.ConfigurationKey + " must be a comma-separated list of Firebase UIDs: 1 to 128 visible ASCII characters each, no empty item.";

    public ValidateOptionsResult Validate(string? name, OperationsOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        return OperatorSubjects.Parse(options.OperatorSubjects).IsSuccess ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(Failure);
    }
}

/// <summary>The policy of the <c>/v1/ops/*</c> routes: a valid Firebase login whose subject is on the list (ADR 0085, D1).</summary>
internal static class OperatorAccess
{
    public const string Policy = "operator-only";
}

/// <summary>The subject of the login is one of <see cref="OperatorSubjects"/>.</summary>
internal sealed class OperatorRequirement : IAuthorizationRequirement
{
    public static readonly OperatorRequirement Instance = new();

    private OperatorRequirement()
    {
    }
}

/// <summary>Reads only the subject claim the Firebase handler wrote; never <c>POST /v1/me</c> nor the database.</summary>
internal sealed class OperatorAuthorizationHandler(OperatorSubjects operators) : AuthorizationHandler<OperatorRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, OperatorRequirement requirement)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.User.Identity?.IsAuthenticated == true && operators.Contains(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

/// <summary>
/// A signed-in person off the list gets the 404 of a route that does not exist, the same body (the status code pages
/// write it), never a 403 that says the route is there; the log has only <c>ops.denied</c>. Every other policy keeps the
/// default answers.
/// </summary>
internal sealed class OperatorDeniedAsNotFound(ILogger<OperatorDeniedAsNotFound> logger) : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler fallback = new();

    public Task HandleAsync(RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult authorizeResult)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(policy);
        ArgumentNullException.ThrowIfNull(authorizeResult);
        if (authorizeResult.Forbidden && policy.Requirements.Contains(OperatorRequirement.Instance))
        {
            OpsLog.Denied(logger);
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return Task.CompletedTask;
        }

        return fallback.HandleAsync(next, context, policy, authorizeResult);
    }
}
