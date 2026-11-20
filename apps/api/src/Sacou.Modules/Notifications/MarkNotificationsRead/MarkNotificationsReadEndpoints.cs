using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.MarkNotificationsRead;

/// <summary>
/// <c>POST /v1/me/notifications/{notificationId}/read</c> and <c>POST /v1/me/notifications/read-all</c> ("Marcar como
/// lidas" of screen 28). Both 204 and idempotent. An id of another person's notification is the same 404 as a missing one.
/// </summary>
internal static class MarkNotificationsReadEndpoints
{
    public const string ReadOneName = "MarkNotificationRead";
    public const string ReadAllName = "MarkAllNotificationsRead";

    public static IEndpointRouteBuilder MapMarkNotificationsRead(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(NotificationRoutes.ReadOne, ReadOneAsync).WithName(ReadOneName).RequireAuthorization()
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);
        endpoints.MapPost(NotificationRoutes.ReadAll, ReadAllAsync).WithName(ReadAllName).RequireAuthorization()
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ReadOneAsync(
        Guid notificationId, Recipients recipients, INotificationStore store, TimeProvider time, CancellationToken cancellationToken)
    {
        var caller = await recipients.CallerAsync(cancellationToken).ConfigureAwait(false);
        if (caller.IsFailure)
        {
            return ProblemResults.From(caller.Error);
        }

        var found = await store.MarkReadAsync(caller.Value.Members, notificationId, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        return found ? TypedResults.NoContent() : ProblemResults.From(NotificationErrors.NotificationNotFound);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ReadAllAsync(
        Recipients recipients, INotificationStore store, TimeProvider time, CancellationToken cancellationToken)
    {
        var caller = await recipients.CallerAsync(cancellationToken).ConfigureAwait(false);
        if (caller.IsFailure)
        {
            return ProblemResults.From(caller.Error);
        }

        await store.MarkAllReadAsync(caller.Value.Members, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        return TypedResults.NoContent();
    }
}
