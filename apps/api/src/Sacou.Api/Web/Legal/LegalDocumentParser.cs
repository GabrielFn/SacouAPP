using System.Globalization;
using System.Text.RegularExpressions;

namespace Sacou.Api.Web.Legal;

/// <summary>
/// Reads the published part of a legal text of <c>docs/legal/</c> (E6.1, ADR 0083): only what lies between the two
/// markers, and never a review note (a line that starts with <c>&gt;</c>). Inside, a small subset of Markdown: the title
/// (<c>#</c>, once, first), then <c>Versão:</c> and <c>Atualizada em: DD/MM/AAAA</c>, then <c>##</c> and <c>###</c>
/// headings, paragraphs (lines joined with a space) and <c>- </c> items. Anything else (HTML, a link, an image, a table,
/// emphasis, a deeper heading, another kind of list) refuses the whole document: the API does not start with it.
/// </summary>
internal static partial class LegalDocumentParser
{
    public const string StartMarker = "<!-- publicar:inicio -->";
    public const string EndMarker = "<!-- publicar:fim -->";
    public const string VersionPrefix = "Versão:";
    public const string UpdatedOnPrefix = "Atualizada em:";
    public const string DateFormat = "dd/MM/yyyy";
    public const string NotePrefix = ">";
    public const string ItemPrefix = "- ";
    public const string TitlePrefix = "# ";
    public const int SectionLevel = 2;
    public const int SubsectionLevel = 3;

    public const string NoStart = "the start marker is missing";
    public const string NoEnd = "the end marker is missing";
    public const string TwoStarts = "the start marker appears twice";
    public const string TwoEnds = "the end marker appears twice";
    public const string EndBeforeStart = "the end marker comes before the start marker";
    public const string NoTitle = "the published part must open with the title (# )";
    public const string SecondTitle = "a second title (# )";
    public const string NoVersion = "the version line (Versão:) is missing";
    public const string NoUpdatedOn = "the date line (Atualizada em:) is missing";
    public const string BadDate = "the date is not a valid DD/MM/AAAA";
    public const string RepeatedHeader = "the version or the date appears twice";
    public const string HeaderOutOfPlace = "the version and the date belong right below the title";
    public const string EmptyHeader = "the version is empty";
    public const string NoBlocks = "the published part has no text";
    public const string DeepHeading = "only #, ## and ### headings are accepted";
    public const string Markup = "HTML, links, images, tables and emphasis are not accepted";
    public const string OtherList = "only - items are accepted";
    public const string ItemContinues = "an item goes on to the next line; write it on one line";

    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    public static LegalParseResult Parse(string source)
    {
        ArgumentNullException.ThrowIfNull(source);
        var lines = source.ReplaceLineEndings("\n").Split('\n');
        var bounds = FindBounds(lines);
        return bounds.Error is { } error
            ? LegalParseResult.Failure(error.Reason, error.Line)
            : new Reader(lines, bounds.Start, bounds.End).Read();
    }

    private static (int Start, int End, LegalParseError? Error) FindBounds(string[] lines)
    {
        int? start = null;
        int? end = null;
        for (var index = 0; index < lines.Length; index++)
        {
            var line = lines[index].Trim();
            if (line == StartMarker)
            {
                if (start is not null)
                {
                    return (0, 0, new LegalParseError(TwoStarts, index + 1));
                }

                start = index;
            }
            else if (line == EndMarker)
            {
                if (end is not null)
                {
                    return (0, 0, new LegalParseError(TwoEnds, index + 1));
                }

                if (start is null)
                {
                    return (0, 0, new LegalParseError(EndBeforeStart, index + 1));
                }

                end = index;
            }
        }

        return (start, end) switch
        {
            (null, _) => (0, 0, new LegalParseError(NoStart, 1)),
            (_, null) => (0, 0, new LegalParseError(NoEnd, lines.Length)),
            ({ } first, { } last) => (first, last, null),
        };
    }

    private static bool HasMarkup(string text) =>
        text.Contains('<', StringComparison.Ordinal) || text.Contains("](", StringComparison.Ordinal)
        || text.Contains("![", StringComparison.Ordinal) || text.Contains('|', StringComparison.Ordinal)
        || text.Contains("**", StringComparison.Ordinal) || text.Contains("__", StringComparison.Ordinal)
        || text.Contains('`', StringComparison.Ordinal);

    [GeneratedRegex(@"^(\d+[.)]|[*+])\s")]
    private static partial Regex OtherListItem();

    /// <summary>One pass over the published part, line by line, keeping the open paragraph or list.</summary>
    private sealed class Reader(string[] lines, int start, int end)
    {
        private readonly List<LegalBlock> _blocks = [];
        private readonly List<string> _paragraph = [];
        private readonly List<string> _items = [];
        private string? _title;
        private string? _version;
        private DateOnly? _updatedOn;
        private bool _lastWasItem;

        public LegalParseResult Read()
        {
            for (var index = start + 1; index < end; index++)
            {
                var problem = ReadLine(lines[index].TrimEnd());
                if (problem is not null)
                {
                    return LegalParseResult.Failure(problem, index + 1);
                }
            }

            Close();
            return Finish();
        }

        private LegalParseResult Finish()
        {
            var afterStart = start + 2;
            if (_title is null)
            {
                return LegalParseResult.Failure(NoTitle, afterStart);
            }

            if (_version is null)
            {
                return LegalParseResult.Failure(NoVersion, afterStart);
            }

            if (_updatedOn is not { } updatedOn)
            {
                return LegalParseResult.Failure(NoUpdatedOn, afterStart);
            }

            return _blocks.Count == 0
                ? LegalParseResult.Failure(NoBlocks, afterStart)
                : LegalParseResult.Success(new LegalDocument(_title, _version, updatedOn, [.. _blocks]));
        }

        private string? ReadLine(string line)
        {
            var trimmed = line.TrimStart();
            if (trimmed.StartsWith(NotePrefix, StringComparison.Ordinal) || trimmed.Length == 0)
            {
                Close();
                return null;
            }

            if (HasMarkup(trimmed))
            {
                return Markup;
            }

            if (_title is null)
            {
                return trimmed.StartsWith(TitlePrefix, StringComparison.Ordinal) && trimmed.Length > TitlePrefix.Length
                    ? SetTitle(trimmed[TitlePrefix.Length..].Trim())
                    : NoTitle;
            }

            if (trimmed.StartsWith('#'))
            {
                return ReadHeading(trimmed);
            }

            if (trimmed.StartsWith(VersionPrefix, StringComparison.Ordinal) || trimmed.StartsWith(UpdatedOnPrefix, StringComparison.Ordinal))
            {
                return _blocks.Count > 0 || _paragraph.Count > 0 || _items.Count > 0 ? HeaderOutOfPlace : ReadHeader(trimmed);
            }

            if (trimmed.StartsWith(ItemPrefix, StringComparison.Ordinal))
            {
                CloseParagraph();
                _items.Add(trimmed[ItemPrefix.Length..].Trim());
                _lastWasItem = true;
                return null;
            }

            if (OtherListItem().IsMatch(trimmed))
            {
                return OtherList;
            }

            if (_lastWasItem)
            {
                return ItemContinues;
            }

            CloseList();
            _paragraph.Add(trimmed);
            return null;
        }

        private string? SetTitle(string title)
        {
            _title = title;
            return null;
        }

        private string? ReadHeading(string trimmed)
        {
            var level = trimmed.TakeWhile(character => character == '#').Count();
            var text = trimmed[level..];
            if (level == 1)
            {
                return SecondTitle;
            }

            if (level > SubsectionLevel || !text.StartsWith(' ') || text.Trim().Length == 0)
            {
                return DeepHeading;
            }

            Close();
            _blocks.Add(new LegalBlock.Heading(level, text.Trim()));
            return null;
        }

        private string? ReadHeader(string trimmed)
        {
            if (trimmed.StartsWith(VersionPrefix, StringComparison.Ordinal))
            {
                if (_version is not null)
                {
                    return RepeatedHeader;
                }

                var version = trimmed[VersionPrefix.Length..].Trim();
                if (version.Length == 0)
                {
                    return EmptyHeader;
                }

                _version = version;
                return null;
            }

            if (_updatedOn is not null)
            {
                return RepeatedHeader;
            }

            if (!DateOnly.TryParseExact(trimmed[UpdatedOnPrefix.Length..].Trim(), DateFormat, Invariant, DateTimeStyles.None, out var date))
            {
                return BadDate;
            }

            _updatedOn = date;
            return null;
        }

        private void Close()
        {
            CloseParagraph();
            CloseList();
        }

        private void CloseParagraph()
        {
            if (_paragraph.Count > 0)
            {
                _blocks.Add(new LegalBlock.Paragraph(string.Join(' ', _paragraph)));
                _paragraph.Clear();
            }
        }

        private void CloseList()
        {
            if (_items.Count > 0)
            {
                _blocks.Add(new LegalBlock.BulletList([.. _items]));
                _items.Clear();
            }

            _lastWasItem = false;
        }
    }
}
