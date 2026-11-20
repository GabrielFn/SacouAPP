using System.Globalization;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Notifications.ListNotifications;

/// <summary>
/// Reads one page by the caller's member ids, then the group names and the rounds of that page only. A notification whose
/// round is gone is left out of the page: rounds are cancelled, never deleted, so it does not happen in the pilot.
/// </summary>
internal sealed class ListNotificationsHandler(
    Recipients recipients, INotificationStore store, IGroupDirectory groups, INotificationRounds rounds)
{
    public async Task<Result<NotificationListResponse>> HandleAsync(string? cursor, CancellationToken cancellationToken)
    {
        var after = NotificationCursors.Parse(cursor);
        if (after.IsFailure)
        {
            return Result.Failure<NotificationListResponse>(after.Error);
        }

        var caller = await recipients.CallerAsync(cancellationToken).ConfigureAwait(false);
        if (caller.IsFailure)
        {
            return Result.Failure<NotificationListResponse>(caller.Error);
        }

        var members = caller.Value.Members;
        var page = await store.ListAsync(members, after.Value.After, NotificationLimits.PageSize + 1, cancellationToken).ConfigureAwait(false);
        var shown = page.Take(NotificationLimits.PageSize).ToList();
        var items = await RenderAsync(shown, cancellationToken).ConfigureAwait(false);
        var unread = await store.CountUnreadAsync(members, cancellationToken).ConfigureAwait(false);
        var next = page.Count > NotificationLimits.PageSize ? NotificationCursors.Format(shown[^1]) : null;
        return Result.Success(new NotificationListResponse(items, unread, next));
    }

    private async Task<IReadOnlyList<NotificationItem>> RenderAsync(IReadOnlyList<NotificationRow> rows, CancellationToken cancellationToken)
    {
        var names = new Dictionary<Guid, string>();
        foreach (var group in rows.Select(row => row.GroupId).Distinct())
        {
            names[group] = await groups.FindNameAsync(group, cancellationToken).ConfigureAwait(false) ?? NotificationTexts.UnknownGroup;
        }

        var keys = rows.Select(row => new NotificationRoundKey(row.GroupId, row.RoundId)).Distinct().ToList();
        var found = keys.Count == 0
            ? new Dictionary<NotificationRoundKey, NotificationRound>()
            : (await rounds.FindAsync(keys, cancellationToken).ConfigureAwait(false)).ToDictionary(round => new NotificationRoundKey(round.GroupId, round.RoundId));
        return [.. rows
            .Where(row => found.ContainsKey(new NotificationRoundKey(row.GroupId, row.RoundId)))
            .Select(row => Render(row, names[row.GroupId], found[new NotificationRoundKey(row.GroupId, row.RoundId)]))];
    }

    private static NotificationItem Render(NotificationRow row, string groupName, NotificationRound round) => new(
        row.Id,
        NotificationItemKind.WaitlistPromoted,
        row.GroupId,
        row.RoundId,
        NotificationTexts.ListTitle(groupName, round.LocalDate),
        NotificationTexts.ListSubtitle(round.LocalDate, round.LocalTime, round.Venue),
        row.CreatedAt,
        row.ReadAt is not null);
}

/// <summary>
/// The page cursor: the last item's instant in UTC ticks and its id, <c>{ticks}.{id:N}</c>. Opaque to the app; anything
/// else is <c>notifications.cursor-invalid</c>.
/// </summary>
internal static class NotificationCursors
{
    private const char Separator = '.';
    private const string IdFormat = "N";

    public static string Format(NotificationRow row)
    {
        ArgumentNullException.ThrowIfNull(row);
        return string.Create(CultureInfo.InvariantCulture, $"{row.CreatedAt.UtcTicks}{Separator}{row.Id.ToString(IdFormat, CultureInfo.InvariantCulture)}");
    }

    /// <summary>No cursor is the first page.</summary>
    public static Result<NotificationPageStart> Parse(string? text)
    {
        if (text is null)
        {
            return Result.Success(new NotificationPageStart(null));
        }

        var parts = text.Split(Separator);
        return parts.Length == 2
            && long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
            && ticks <= DateTimeOffset.MaxValue.UtcTicks
            && Guid.TryParseExact(parts[1], IdFormat, out var id)
                ? Result.Success(new NotificationPageStart(new NotificationCursor(new DateTimeOffset(ticks, TimeSpan.Zero), id)))
                : Result.Failure<NotificationPageStart>(NotificationErrors.CursorInvalid);
    }
}

/// <summary>Where a page starts: after <see cref="After"/>, or at the newest when it is null.</summary>
internal sealed record NotificationPageStart(NotificationCursor? After);
