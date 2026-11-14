using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Identity.GetMyProfile;
using ContractPlaying = Sacou.Modules.Identity.Contracts.PlayingPosition;
using ContractPrimary = Sacou.Modules.Identity.Contracts.PrimaryPosition;

namespace Sacou.Modules.Identity.SaveMyProfile;

/// <summary>
/// <c>PUT /v1/me/profile</c> <c>{ nickname, primaryPosition, otherPositions, suggestedLevel }</c>: creates or replaces
/// the caller's profile and answers it as stored (NFC, canonical order). The last write wins (ADR 0051, D10).
/// </summary>
internal static class SaveMyProfileEndpoint
{
    public const string Name = "SaveMyProfile";

    public static IEndpointRouteBuilder MapSaveMyProfile(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPut(MyProfileRoute.Path, HandleAsync).WithName(Name).RequireAuthorization()
            .WithMetadata(new RequestSizeLimitAttribute(MyProfileRoute.MaxBodyBytes))
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    private static async Task<Results<Ok<MyProfileResponse>, ProblemHttpResult>> HandleAsync(
        SaveMyProfileRequest request, SaveMyProfileHandler handler, CancellationToken cancellationToken)
    {
        var saved = await handler.HandleAsync(request, cancellationToken).ConfigureAwait(false);
        return saved.ToHttpResult(TypedResults.Ok);
    }
}

/// <summary>
/// The four fields, each one present (a missing key is a 400, never a default); <c>primaryPosition</c> and
/// <c>suggestedLevel</c> may be null. The level is a JSON number only: <c>"4.5"</c> is a 400, though the web
/// defaults read numbers from strings. A field the record does not declare is a 400 too (ADR 0039).
/// </summary>
internal sealed record SaveMyProfileRequest(
    [property: JsonRequired] string? Nickname,
    [property: JsonRequired] ContractPrimary? PrimaryPosition,
    [property: JsonRequired] IReadOnlyList<ContractPlaying>? OtherPositions,
    [property: JsonRequired, JsonNumberHandling(JsonNumberHandling.Strict)] decimal? SuggestedLevel);
