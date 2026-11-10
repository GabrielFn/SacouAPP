namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>
/// The Identity user behind a member, as the Groups module sees it: the <see cref="Guid"/> that
/// <c>Identity.Contracts.ICurrentUser</c> gives. Never in events, which use <see cref="Sacou.Shared.Members.MemberId"/>.
/// </summary>
internal readonly record struct UserId(Guid Value);
