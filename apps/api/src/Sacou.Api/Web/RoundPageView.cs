using System.Globalization;
using Sacou.Modules.Sessions.Contracts;

namespace Sacou.Api.Web;

/// <summary>
/// Screen 01 from the public summary, every text already in pt-BR: the Razor page only lays it out (and encodes it).
/// The names are those of the summary (question 126, option 2); the preview line has none.
/// </summary>
internal sealed record RoundPageView(
    string GroupName,
    string When,
    string Format,
    int GoingCount,
    int? Capacity,
    string? Hint,
    string? ClosedMessage,
    IReadOnlyList<PageList> Lists,
    string? Notice,
    IReadOnlyList<bool> Court,
    string PreviewDescription)
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string TimeFormat = "HH:mm";

    public bool IsOpen => ClosedMessage is null;

    public static RoundPageView From(PublicRoundSummary summary)
    {
        ArgumentNullException.ThrowIfNull(summary);
        var date = DateOnly.ParseExact(summary.LocalDate, DateFormat, CultureInfo.InvariantCulture);
        var time = TimeOnly.ParseExact(summary.LocalTime, TimeFormat, CultureInfo.InvariantCulture);
        var day = WebTexts.Day(date);
        var hour = WebTexts.Hour(time);
        var missing = summary.Capacity is { } capacity ? Math.Max(0, capacity - summary.GoingCount) : (int?)null;
        return new RoundPageView(
            summary.GroupName,
            string.Join(" · ", day, hour, summary.Venue),
            WebTexts.Format(summary.PlayersPerTeam, summary.PointsPerSet, summary.LoserLeaves),
            summary.GoingCount,
            summary.Capacity,
            HintOf(summary, missing),
            ClosedMessageOf(summary.State),
            ListsOf(summary),
            NoticeOf(summary, missing),
            CourtOf(summary),
            PreviewOf(summary, day, hour));
    }

    private static string? ClosedMessageOf(PublicRoundState state) => state switch
    {
        PublicRoundState.Canceled => WebTexts.Canceled,
        PublicRoundState.Started => WebTexts.Started,
        PublicRoundState.Open or PublicRoundState.Full => null,
        _ => throw new ArgumentOutOfRangeException(nameof(state), state, "Unknown round state."),
    };

    private static string? HintOf(PublicRoundSummary summary, int? missing) => summary.State switch
    {
        PublicRoundState.Full => WebTexts.Full(summary.WaitlistEnabled),
        PublicRoundState.Open when missing is > 0 => WebTexts.Missing(missing.Value),
        _ => null,
    };

    private static string? NoticeOf(PublicRoundSummary summary, int? missing)
    {
        if (summary.State != PublicRoundState.Open)
        {
            return summary.WaitlistCount > 0 ? WebTexts.Waiting(summary.WaitlistCount) : null;
        }

        return missing is > 0 && summary.WaitlistEnabled ? WebTexts.MissingSpots(missing.Value) : null;
    }

    /// <summary>The marks at the right of the count: one per spot, taken first. Without a limit, one per confirmed.</summary>
    private static IReadOnlyList<bool> CourtOf(PublicRoundSummary summary)
    {
        var spots = summary.Capacity ?? summary.GoingCount;
        return [.. Enumerable.Range(0, spots).Select(index => index < summary.GoingCount)];
    }

    /// <summary>"Qui, 5/11 · 19h · Arena Beira-Mar · 9/12 confirmados": no name of anyone, even with the names on the page.</summary>
    private static string PreviewOf(PublicRoundSummary summary, string day, string hour) => summary.State == PublicRoundState.Canceled
        ? string.Join(" · ", day, hour, summary.Venue, WebTexts.Canceled.TrimEnd('.'))
        : string.Join(" · ", day, hour, summary.Venue, WebTexts.Confirmations(summary.GoingCount, summary.Capacity));

    /// <summary>
    /// Mensalistas first and then the avulsos, as on screen 01, numbered on; without a mensalista on the list, one list.
    /// The open spots close the last list.
    /// </summary>
    private static IReadOnlyList<PageList> ListsOf(PublicRoundSummary summary)
    {
        var regulars = summary.Going.Where(entry => entry.Regular).ToList();
        var others = summary.Going.Where(entry => !entry.Regular).ToList();
        var vacant = summary.Capacity is { } capacity ? Math.Max(0, capacity - summary.GoingCount) : 0;
        if (regulars.Count == 0)
        {
            var count = summary.Capacity is { } limit ? WebTexts.OfCapacity(others.Count, limit) : Number(others.Count);
            return [new PageList(WebTexts.Everyone, count, Lines(others, first: 1, vacant))];
        }

        var dropInCount = summary.Capacity is { } total
            ? WebTexts.SpotsOf(others.Count, Math.Max(others.Count, total - regulars.Count))
            : Number(others.Count);
        return
        [
            new PageList(WebTexts.Regulars, Number(regulars.Count), Lines(regulars, first: 1, vacant: 0)),
            new PageList(WebTexts.DropIns, dropInCount, Lines(others, first: regulars.Count + 1, vacant)),
        ];
    }

    private static List<PageListLine> Lines(List<PublicListEntry> entries, int first, int vacant) =>
    [
        .. entries.Select((entry, index) => new PageListLine(first + index, entry.Nickname ?? WebTexts.NoNickname)),
        .. Enumerable.Range(first + entries.Count, vacant).Select(place => new PageListLine(place, Name: null)),
    ];

    private static string Number(int value) => value.ToString(CultureInfo.InvariantCulture);
}

/// <summary>One list of screen 01: its title, the count at its right and its lines.</summary>
internal sealed record PageList(string Title, string Count, IReadOnlyList<PageListLine> Lines);

/// <summary>One line: the place and the first name, or no name for an open spot.</summary>
internal sealed record PageListLine(int Place, string? Name)
{
    public bool IsVacant => Name is null;
}
