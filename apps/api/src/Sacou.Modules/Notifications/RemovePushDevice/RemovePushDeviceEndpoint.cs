using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Notifications.RemovePushDevice;

/// <summary>
/// <c>DELETE /v1/me/push-devices/{installationId}</c>: the first step of signing out (ADR 0069, D8). Always 204, again
/// too, and for an installation of another account as well, which stays untouched: the answer reveals nothing.
/// </summary>
internal static class RemovePushDeviceEndpoint
{
    public const string Name = "RemovePushDevice";

    public static IEndpointRouteBuilder MapRemovePushDevice(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapDelete(NotificationRoutes.PushDevice, HandleAsync).WithName(Name).RequireAuthorization()
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid installationId, Recipients recipients, IPushDeviceStore devices, CancellationToken cancellationToken)
    {
        var user = await recipients.UserAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsSuccess)
        {
            await devices.RemoveAsync(user.Value, installationId, cancellationToken).ConfigureAwait(false);
        }

        return (user.IsSuccess ? Result.Success(true) : Result.Failure<bool>(user.Error)).ToHttpResult(_ => TypedResults.NoContent());
    }
}
