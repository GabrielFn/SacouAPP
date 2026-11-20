using System.Collections.Immutable;
using System.Globalization;

namespace Sacou.Modules.Notifications.Application;

/// <summary>
/// Every pt-BR text the server writes for a notification, in one file (ADR 0069, D7; docs/dominio/notificacoes.md). The
/// date and time are the round's local ones, never converted. The push (lock screen, through Expo, Google and Apple) has
/// the group, the day and the hour only, never the venue nor a name (question 112); the list of screen 28 has the venue.
/// </summary>
internal static class NotificationTexts
{
    public const string PushTitle = "Você saiu da espera";

    /// <summary>When the group is gone and its name cannot be read.</summary>
    public const string UnknownGroup = "seu grupo";

    private const string Separator = " · ";

    /// <summary>Sunday first, as <see cref="DayOfWeek"/>.</summary>
    private static readonly ImmutableArray<string> ShortDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

    private static readonly ImmutableArray<string> LongDays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

    /// <summary>"Entrou no Areia · sáb 8h".</summary>
    public static string PushBody(string groupName, DateOnly date, TimeOnly time) =>
        $"Entrou no {groupName}{Separator}{ShortDay(date)} {Hour(time)}";

    /// <summary>"Você saiu da espera: entrou no Areia de sábado".</summary>
    public static string ListTitle(string groupName, DateOnly date) =>
        $"{PushTitle}: entrou no {groupName} de {LongDays[(int)date.DayOfWeek]}";

    /// <summary>"Sáb 8h · Posto 6"; without a venue, "Sáb 8h".</summary>
    public static string ListSubtitle(DateOnly date, TimeOnly time, string venue)
    {
        ArgumentNullException.ThrowIfNull(venue);
        var day = ShortDay(date);
        var when = $"{char.ToUpper(day[0], CultureInfo.InvariantCulture)}{day[1..]} {Hour(time)}";
        return venue.Length == 0 ? when : $"{when}{Separator}{venue}";
    }

    /// <summary>"8h", "19h30", "0h".</summary>
    public static string Hour(TimeOnly time) =>
        time.Minute == 0
            ? string.Create(CultureInfo.InvariantCulture, $"{time.Hour}h")
            : string.Create(CultureInfo.InvariantCulture, $"{time.Hour}h{time.Minute:D2}");

    private static string ShortDay(DateOnly date) => ShortDays[(int)date.DayOfWeek];
}
