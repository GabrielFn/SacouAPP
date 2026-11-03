using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>Carries only a path from the schema, never a received key or value.</summary>
internal sealed record PayloadError(string Field)
{
    public const string InvalidPayloadCode = "invalid-payload";

    public string Code { get; } = InvalidPayloadCode;
}

/// <summary>
/// The leaf checks of the payload parsers. A missing member is <c>null</c> here, and JSON null is
/// <see cref="RawNull"/>: absent never passes for null (<c>readOwn</c> in TypeScript). Every check
/// is by value against an allowed list, with text compared by UTF-16 code unit.
/// </summary>
internal static class PayloadValues
{
    public static RawValue? Member(RawObject record, string key) => record.TryGetMember(key, out var value) ? value : null;

    public static bool IsNull(RawValue? value) => value is RawNull;

    public static string? Uuid(RawValue? value) =>
        value is RawString text && LowercaseUuid.IsValid(text.Value) ? text.Value : null;

    public static int? Integer(RawValue? value, int min, int max) => (int?)SafeInteger.Read(value, min, max);

    public static int? OneOf(RawValue? value, ImmutableArray<int> allowed) =>
        SafeInteger.Read(value, allowed.Min(), allowed.Max()) is { } number && allowed.Contains((int)number) ? (int)number : null;

    public static long? Version(RawValue? value) => SafeInteger.Read(value, ScoreLimits.MinVersion, (long)EventLogSchema.MaxSafeInteger);

    public static int? SetPoints(RawValue? value) => Integer(value, ScoreLimits.MinSetPoints, ScoreLimits.MaxSetPoints);

    public static int? SetNumber(RawValue? value) => Integer(value, ScoreLimits.FirstSetNumber, ScoreLimits.LastSetNumber);

    public static int? SetterZone(RawValue? value) => OneOf(value, RotationRules.SetterZoneSequence);

    public static TeamSide? Side(RawValue? value) => ByCode(value, TeamSide.All, side => side.Code);

    public static FormationSystem? System(RawValue? value) => ByCode(value, FormationSystem.All, system => system.Code);

    public static MatchEndReason? EndReason(RawValue? value) => ByCode(value, MatchEndReason.All, reason => reason.Code);

    public static PointKind? Kind(RawValue? value) => ByCode(value, PointKind.All, kind => kind.Code);

    /// <summary>
    /// The size is checked before walking, so a huge list costs nothing; then each item is a UUID and
    /// none repeats.
    /// </summary>
    public static ImmutableArray<string>? UniqueMemberIds(RawValue? value, int min, int max)
    {
        if (value is not RawArray { Items: var items } || items.Length < min || items.Length > max)
        {
            return null;
        }

        ImmutableArray<string> memberIds = [.. items.Select(Uuid).OfType<string>()];
        return memberIds.Length == items.Length && memberIds.Distinct(StringComparer.Ordinal).Count() == items.Length
            ? memberIds
            : null;
    }

    /// <summary>
    /// One index or a diagonal of the lineup. Integers only, compared by value: <c>2.0</c> is 2, and
    /// <c>2.5</c> is refused, as JavaScript refuses it by <c>includes</c>.
    /// </summary>
    public static ImmutableArray<int>? ReplacedIndexes(RawValue? value)
    {
        if (value is not RawArray { Items: var items } || items.Length > LiberoRules.MaxLiberoReplacedIndexes)
        {
            return null;
        }

        ImmutableArray<int> indexes = [.. items.Select(item => Integer(item, int.MinValue, int.MaxValue)).OfType<int>()];
        return indexes.Length == items.Length && LiberoRules.IsLiberoCoverage(indexes) ? indexes : null;
    }

    private static T? ByCode<T>(RawValue? value, ImmutableArray<T> allowed, Func<T, string> codeOf)
        where T : class =>
        value is RawString text
            ? allowed.FirstOrDefault(candidate => string.Equals(codeOf(candidate), text.Value, StringComparison.Ordinal))
            : null;
}
