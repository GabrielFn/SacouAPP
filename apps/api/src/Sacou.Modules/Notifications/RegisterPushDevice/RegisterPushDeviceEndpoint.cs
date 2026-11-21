using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Notifications.RegisterPushDevice;

/// <summary>
/// <c>PUT /v1/me/push-devices</c> <c>{ installationId, token, platform }</c>: registers or refreshes the phone (ADR 0069,
/// D8). Idempotent: the same body again is a 204 that writes at most once a day. The answer never echoes the token, and
/// the installation id stays in the body, out of the path the hosting logs see.
/// </summary>
internal static class RegisterPushDeviceEndpoint
{
    public const string Name = "RegisterPushDevice";

    public static IEndpointRouteBuilder MapRegisterPushDevice(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPut(NotificationRoutes.PushDevices, HandleAsync).WithName(Name).RequireAuthorization()
            .WithMetadata(new RequestSizeLimitAttribute(NotificationLimits.MaxDeviceBodyBytes))
            .RequireRateLimiting(RateLimitPolicies.PushDevice)
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        RegisterPushDeviceRequest request,
        Recipients recipients,
        IPushDeviceStore devices,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var registered = await RegisterAsync(request, recipients, devices, time, cancellationToken).ConfigureAwait(false);
        return registered.ToHttpResult(_ => TypedResults.NoContent());
    }

    private static async Task<Result<bool>> RegisterAsync(
        RegisterPushDeviceRequest request,
        Recipients recipients,
        IPushDeviceStore devices,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        if (request.InstallationId is not { } installationId || installationId == Guid.Empty)
        {
            return Result.Failure<bool>(NotificationErrors.InstallationInvalid);
        }

        var token = PushToken.Parse(request.Token);
        if (token.IsFailure || request.Platform is null)
        {
            return Result.Failure<bool>(NotificationErrors.TokenInvalid);
        }

        var user = await recipients.UserAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<bool>(user.Error);
        }

        await devices.RegisterAsync(user.Value, installationId, token.Value, ToPlatform(request.Platform), time.GetUtcNow(), cancellationToken)
            .ConfigureAwait(false);
        return Result.Success(true);
    }

    private static PushPlatform ToPlatform(PushDevicePlatform? platform) => platform switch
    {
        PushDevicePlatform.Android => PushPlatform.Android,
        PushDevicePlatform.Ios => PushPlatform.Ios,
        _ => throw new ArgumentOutOfRangeException(nameof(platform), platform, "A checked request always has a platform."),
    };
}

/// <summary>All three fields present (a missing key is a 400); a field the record does not declare is a 400 too (ADR 0039).</summary>
internal sealed record RegisterPushDeviceRequest(
    [property: JsonRequired] Guid? InstallationId,
    [property: JsonRequired] string? Token,
    [property: JsonRequired] PushDevicePlatform? Platform);

/// <summary>The phone's system, as the app sends it: <c>android</c> or <c>ios</c>.</summary>
internal enum PushDevicePlatform
{
    Android,
    Ios,
}
