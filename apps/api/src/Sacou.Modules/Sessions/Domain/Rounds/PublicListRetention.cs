namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>
/// How long the public page <c>/r/{code}</c> shows who went (E6.7, question 224, ADR 0070, D5): 7 days from the round's
/// start instant, in UTC, so neither the close nor the local day moves the cut. A canceled round and one never closed
/// expire alike.
/// </summary>
internal static class PublicListRetention
{
    public static readonly TimeSpan Period = TimeSpan.FromDays(7);

    /// <summary>True from <paramref name="startsAt"/> plus <see cref="Period"/> on, the very instant included.</summary>
    public static bool IsExpired(DateTimeOffset startsAt, DateTimeOffset now) => now >= startsAt + Period;
}
