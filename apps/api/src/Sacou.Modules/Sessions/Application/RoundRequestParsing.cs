using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Application;

/// <summary>Text from a request to domain values. Every refusal is the same <c>sessions.round-invalid</c>: the body never says which field.</summary>
internal static class RoundRequestParsing
{
    public static Result<DateOnly> Date(string? text) =>
        DateOnly.TryParseExact(text, RoundFormat.DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? Result.Success(date)
            : Result.Failure<DateOnly>(RoundErrors.RoundInvalid);

    public static Result<TimeOnly> Time(string? text) =>
        TimeOnly.TryParseExact(text, RoundFormat.TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time)
            ? Result.Success(time)
            : Result.Failure<TimeOnly>(RoundErrors.RoundInvalid);

    /// <summary>An object is the layer; <c>null</c> (or absent) is "no layer"; anything else is a refused layer.</summary>
    public static Result<RequestedLayer> Layer(JsonElement settings) => settings.ValueKind switch
    {
        JsonValueKind.Object => Result.Success(new RequestedLayer(settings.GetRawText())),
        JsonValueKind.Null or JsonValueKind.Undefined => Result.Success(new RequestedLayer(null)),
        _ => Result.Failure<RequestedLayer>(GroupAccessErrors.SettingsInvalid),
    };
}

/// <summary>The raw JSON of a layer from a request, or null for "no layer"; validated later by the Groups.</summary>
internal readonly record struct RequestedLayer(string? Json);
