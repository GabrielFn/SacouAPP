namespace Sacou.Modules.Identity.Contracts;

/// <summary>The internal user id as a <see cref="Guid"/>: the Identity <c>UserId</c> type stays internal.</summary>
public sealed record CurrentUser(Guid UserId);
