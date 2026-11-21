using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sacou.Modules.Identity.Contracts;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// The scheme of the internal routes (ADR 0069, D11): one <c>Authorization: Bearer</c> header with the Google OIDC token
/// of the calling account. Every refusal, a Firebase token included, and keys out of reach too, is the same 401: Cloud
/// Tasks tries again on its own, and the answer tells a stranger nothing.
/// </summary>
internal sealed partial class ServiceCallerAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory loggerFactory,
    UrlEncoder encoder,
    ServiceCallerTokenVerifier verifier) : AuthenticationHandler<AuthenticationSchemeOptions>(options, loggerFactory, encoder)
{
    /// <summary>The subject of the principal: the rate limiter counts the service caller as one caller.</summary>
    public const string Subject = "service:" + ServiceCallers.AuthenticationScheme;

    private const string FailureMessage = "The service caller token was refused.";

    private readonly ILogger rejectionLogger = loggerFactory.CreateLogger<ServiceCallerAuthenticationHandler>();

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (JwtReading.ReadBearerToken(Request.Headers.Authorization) is not { } token)
        {
            return Refuse(ServiceCallerRejection.Malformed);
        }

        var rejection = await verifier.VerifyAsync(token, Context.RequestAborted).ConfigureAwait(false);
        if (rejection is { } refused)
        {
            return Refuse(refused);
        }

        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Subject)], Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    }

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties) => HandleChallengeAsync(properties);

    private AuthenticateResult Refuse(ServiceCallerRejection rejection)
    {
        LogRejected(rejectionLogger, rejection);
        return AuthenticateResult.Fail(FailureMessage);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Service caller token refused: {Rejection}.")]
    private static partial void LogRejected(ILogger logger, ServiceCallerRejection rejection);
}
