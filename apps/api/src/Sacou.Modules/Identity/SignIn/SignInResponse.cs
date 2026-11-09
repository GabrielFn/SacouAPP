namespace Sacou.Modules.Identity.SignIn;

/// <summary>The body of <c>POST /v1/me</c>: the internal user id and nothing from the token.</summary>
internal sealed record SignInResponse(Guid UserId);
