using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Notifications.RemovePushDevice;

/// <summary>
/// <c>POST /v1/me/push-devices/remove</c> <c>{ installationId }</c>: the first step of signing out (ADR 0069, D8). Always
/// 204, again too, and for an installation of another account as well, which stays untouched: the answer reveals nothing.
/// A POST with a body, not a DELETE with the id in the path: the path reaches the hosting logs.
/// </summary>
internal static class RemovePushDeviceEndpoint
{
    public const string Name = "RemovePushDevice";

    public static IEndpointRouteBuilder MapRemovePushDevice(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(NotificationRoutes.RemovePushDevice, HandleAsync).WithName(Name).RequireAuthorization()
            .WithMetadata(new RequestSizeLimitAttribute(NotificationLimits.MaxDeviceBodyBytes))
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        RemovePushDeviceRequest request, Recipients recipients, IPushDeviceStore devices, CancellationToken cancellationToken)
    {
        if (request.InstallationId is not { } installationId || installationId == Guid.Empty)
        {
            return Result.Failure<bool>(NotificationErrors.InstallationInvalid).ToHttpResult(_ => TypedResults.NoContent());
        }

        var user = await recipients.UserAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsSuccess)
        {
            await devices.RemoveAsync(user.Value, installationId, cancellationToken).ConfigureAwait(false);
        }

        return (user.IsSuccess ? Result.Success(true) : Result.Failure<bool>(user.Error)).ToHttpResult(_ => TypedResults.NoContent());
    }
}

/// <summary>The installation id only; another field is a 400 (ADR 0039).</summary>
internal sealed record RemovePushDeviceRequest([property: JsonRequired] Guid? InstallationId);
