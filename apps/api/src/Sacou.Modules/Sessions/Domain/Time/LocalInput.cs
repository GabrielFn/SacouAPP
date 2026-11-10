using System.Globalization;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Time;

/// <summary>The wire formats of the round: <c>YYYY-MM-DD</c> and <c>HH:mm</c>, nothing looser. Every refusal is the same error.</summary>
internal static class LocalInput
{
    public const string DateFormat = "yyyy-MM-dd";
    public const string TimeFormat = "HH:mm";

    public static Result<DateOnly> ParseDate(string? text) =>
        text is not null && DateOnly.TryParseExact(text, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? Result.Success(date)
            : Result.Failure<DateOnly>(RoundErrors.RoundInvalid);

    public static Result<TimeOnly> ParseTime(string? text) =>
        text is not null && TimeOnly.TryParseExact(text, TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time)
            ? Result.Success(time)
            : Result.Failure<TimeOnly>(RoundErrors.RoundInvalid);
}
