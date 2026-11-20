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
/// round is gone is left out of the page: rounds are cancelled, never deleted, so it does not happen in the pilot. A
/// notification of a member id that is no longer an active member shows no venue: the round's current place is for the
/// group's members only (ADR 0069, D7).
/// </summary>
internal sealed class ListNotificationsHandler(
    Recipients recipients, INotificationStore store, IGroupDirectory groups, IGroupMembership membership, INotificationRounds rounds)
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
        var items = await RenderAsync(caller.Value.UserId, shown, cancellationToken).ConfigureAwait(false);
        var unread = await store.CountUnreadAsync(members, cancellationToken).ConfigureAwait(false);
        var next = page.Count > NotificationLimits.PageSize ? NotificationCursors.Format(shown[^1]) : null;
        return Result.Success(new NotificationListResponse(items, unread, next));
    }

    private async Task<IReadOnlyList<NotificationItem>> RenderAsync(Guid user, IReadOnlyList<NotificationRow> rows, CancellationToken cancellationToken)
    {
        var names = new Dictionary<Guid, string>();
        var activeMembers = new HashSet<Guid>();
        foreach (var group in rows.Select(row => row.GroupId).Distinct())
        {
            names[group] = await groups.FindNameAsync(group, cancellationToken).ConfigureAwait(false) ?? NotificationTexts.UnknownGroup;
            if (await membership.FindActiveAsync(group, user, cancellationToken).ConfigureAwait(false) is { } active)
            {
                _ = activeMembers.Add(active.MemberId);
            }
        }

        var keys = rows.Select(row => new NotificationRoundKey(row.GroupId, row.RoundId)).Distinct().ToList();
        var found = keys.Count == 0
            ? new Dictionary<NotificationRoundKey, NotificationRound>()
            : (await rounds.FindAsync(keys, cancellationToken).ConfigureAwait(false)).ToDictionary(round => new NotificationRoundKey(round.GroupId, round.RoundId));
        return [.. rows
            .Where(row => found.ContainsKey(new NotificationRoundKey(row.GroupId, row.RoundId)))
            .Select(row => NotificationItems.Render(
                row, names[row.GroupId], found[new NotificationRoundKey(row.GroupId, row.RoundId)], activeMembers.Contains(row.MemberId)))];
    }
}

/// <summary>One item of the list, from the ids stored and what the other modules say now.</summary>
internal static class NotificationItems
{
    /// <summary>Without the venue when <paramref name="stillMember"/> is false: a former member no longer learns where the group plays.</summary>
    public static NotificationItem Render(NotificationRow row, string groupName, NotificationRound round, bool stillMember)
    {
        ArgumentNullException.ThrowIfNull(row);
        ArgumentNullException.ThrowIfNull(round);
        return new NotificationItem(
            row.Id,
            NotificationItemKind.WaitlistPromoted,
            row.GroupId,
            row.RoundId,
            NotificationTexts.ListTitle(groupName, round.LocalDate),
            NotificationTexts.ListSubtitle(round.LocalDate, round.LocalTime, stillMember ? round.Venue : string.Empty),
            row.CreatedAt,
            row.ReadAt is not null);
    }
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
