namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// <c>Number.isSafeInteger</c> on a received number, always through the double, as in JavaScript:
/// <c>25.0</c> and <c>2.5e1</c> are 25, and NaN, Infinity, fractions and <c>9007199254740992</c> are
/// refused. Never <c>GetInt32</c> (ADR 0033, D5).
/// </summary>
internal static class SafeInteger
{
    public static long? Read(RawValue? value, long min, long max)
    {
        if (value is not RawNumber { Value: var number }
            || !double.IsFinite(number)
            || Math.Floor(number) != number
            || Math.Abs(number) > EventLogSchema.MaxSafeInteger)
        {
            return null;
        }

        return number >= min && number <= max ? (long)number : null;
    }
}
