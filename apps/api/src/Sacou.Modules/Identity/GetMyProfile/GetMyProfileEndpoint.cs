using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Profiles;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.GetMyProfile;

/// <summary>
/// <c>GET /v1/me/profile</c>: the caller's profile, 404 <c>identity.profile-not-found</c> when they never saved one
/// (the app then opens screen 27), 403 <c>identity.user-not-registered</c> before <c>POST /v1/me</c>.
/// </summary>
internal static class GetMyProfileEndpoint
{
    public const string Name = "GetMyProfile";

    public static IEndpointRouteBuilder MapGetMyProfile(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(MyProfileRoute.Path, HandleAsync).WithName(Name).RequireAuthorization()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);
        return endpoints;
    }

    private static async Task<Results<Ok<MyProfileResponse>, ProblemHttpResult>> HandleAsync(
        ICurrentUser currentUser, IPlayerProfileStore store, CancellationToken cancellationToken)
    {
        var found = await FindAsync(currentUser, store, cancellationToken).ConfigureAwait(false);
        return found.ToHttpResult(profile => TypedResults.Ok(MyProfileResponse.From(profile)));
    }

    private static async Task<Result<PlayerProfile>> FindAsync(ICurrentUser currentUser, IPlayerProfileStore store, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<PlayerProfile>(user.Error);
        }

        var profile = await store.FindAsync(new UserId(user.Value.UserId), cancellationToken).ConfigureAwait(false);
        return profile is null ? Result.Failure<PlayerProfile>(ProfileErrors.ProfileNotFound) : Result.Success(profile);
    }
}
