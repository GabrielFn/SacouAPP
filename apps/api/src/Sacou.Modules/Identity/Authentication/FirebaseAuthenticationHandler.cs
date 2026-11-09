using System.Globalization;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// Reads only one <c>Authorization: Bearer</c> header (never the query string or a cookie), asks the
/// verifier and builds a principal with a single claim, the subject. Every refusal is the same 401;
/// signing keys out of reach give 503 with <c>Retry-After</c>, so the app keeps the person signed in.
/// </summary>
internal sealed partial class FirebaseAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory loggerFactory,
    UrlEncoder encoder,
    IIdTokenVerifier verifier) : AuthenticationHandler<AuthenticationSchemeOptions>(options, loggerFactory, encoder)
{
    public static readonly TimeSpan RetryAfter = TimeSpan.FromSeconds(30);

    private const string BearerScheme = "Bearer";
    private const string BearerPrefix = BearerScheme + " ";
    private const string FailureMessage = "The bearer token was refused.";

    private static readonly object KeysUnavailableItem = new();

    private readonly ILogger rejectionLogger = loggerFactory.CreateLogger<FirebaseAuthenticationHandler>();

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var headers = Request.Headers.Authorization;
        if (headers.Count == 0)
        {
            return AuthenticateResult.NoResult();
        }

        if (ReadBearerToken(headers) is not { } token)
        {
            return Refuse(IdTokenRejection.Malformed);
        }

        var verified = await verifier.VerifyAsync(token, Context.RequestAborted).ConfigureAwait(false);
        return verified.Match(Accept, error => Refuse(error.ToRejection()));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        if (Context.Items.ContainsKey(KeysUnavailableItem))
        {
            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            Response.Headers.RetryAfter = ((int)RetryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
            return Task.CompletedTask;
        }

        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.Headers.WWWAuthenticate = BearerScheme;
        return Task.CompletedTask;
    }

    /// <summary>Exactly one header, the scheme in its usual case, and a token with no spaces.</summary>
    private static string? ReadBearerToken(StringValues headers)
    {
        var value = headers.Count == 1 ? headers[0] : null;
        if (value is null || !value.StartsWith(BearerPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        var token = value[BearerPrefix.Length..];
        return token.Length > 0 && !token.Any(char.IsWhiteSpace) ? token : null;
    }

    private AuthenticateResult Accept(VerifiedLogin login)
    {
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, login.Subject.Value)], Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }

    private AuthenticateResult Refuse(IdTokenRejection rejection)
    {
        LogRejected(rejectionLogger, rejection);
        if (rejection == IdTokenRejection.SigningKeysUnavailable)
        {
            Context.Items[KeysUnavailableItem] = true;
        }

        return AuthenticateResult.Fail(FailureMessage);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "ID token refused: {Rejection}.")]
    private static partial void LogRejected(ILogger logger, IdTokenRejection rejection);
}
