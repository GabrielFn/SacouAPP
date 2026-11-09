using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.CurrentUsers;

/// <summary>
/// Reads the subject of the principal and finds the user, once per request (scoped). Nothing comes from
/// a claim but the subject: no role, no cached membership.
/// </summary>
internal sealed class HttpCurrentUser(IHttpContextAccessor accessor, IUserStore users) : ICurrentUser
{
    private Task<Result<CurrentUser>>? lookup;

    public Task<Result<CurrentUser>> GetAsync(CancellationToken cancellationToken) =>
        lookup ??= FindAsync(cancellationToken);

    private async Task<Result<CurrentUser>> FindAsync(CancellationToken cancellationToken)
    {
        var subject = AuthSubject.Create(accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier));
        if (subject.IsFailure)
        {
            return Result.Failure<CurrentUser>(CurrentUserErrors.NotRegistered);
        }

        var id = await users.FindIdAsync(subject.Value, cancellationToken).ConfigureAwait(false);
        return id is { } found
            ? Result.Success(new CurrentUser(found.Value))
            : Result.Failure<CurrentUser>(CurrentUserErrors.NotRegistered);
    }
}
