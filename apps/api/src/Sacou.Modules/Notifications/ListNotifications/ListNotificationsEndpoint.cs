using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Notifications.Application;

namespace Sacou.Modules.Notifications.ListNotifications;

/// <summary>
/// <c>GET /v1/me/notifications?cursor=</c>: screen 28, newest first, <see cref="Domain.NotificationLimits.PageSize"/> per
/// page, with the unread count for the bell. Only the notifications of the caller's own members; never cached.
/// </summary>
internal static class ListNotificationsEndpoint
{
    public const string Name = "ListNotifications";

    public static IEndpointRouteBuilder MapListNotifications(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(NotificationRoutes.Notifications, HandleAsync).WithName(Name).RequireAuthorization()
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    private static async Task<Results<Ok<NotificationListResponse>, ProblemHttpResult>> HandleAsync(
        string? cursor, ListNotificationsHandler handler, CancellationToken cancellationToken)
    {
        var listed = await handler.HandleAsync(cursor, cancellationToken).ConfigureAwait(false);
        return listed.ToHttpResult(TypedResults.Ok);
    }
}

/// <summary>A page: the items, how many of all the caller's notifications are unread, and the cursor of the next page (null at the end).</summary>
internal sealed record NotificationListResponse(IReadOnlyList<NotificationItem> Items, int UnreadCount, string? NextCursor);

/// <summary>One line of screen 28, its text rendered now from ids (a renamed group shows right). Tapping it opens the round.</summary>
internal sealed record NotificationItem(
    Guid Id, NotificationItemKind Kind, Guid GroupId, Guid RoundId, string Title, string Subtitle, DateTimeOffset CreatedAt, bool Read);

internal enum NotificationItemKind
{
    WaitlistPromoted,
}
