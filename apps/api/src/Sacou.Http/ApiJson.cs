using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;

namespace Sacou.Http;

/// <summary>
/// The JSON rules of every request body (ADR 0039): a field the DTO does not declare is a 400, against
/// mass assignment; a key repeated in one object is a 400, so no reader picks a different copy; enums
/// travel as text only, so <c>"role": 0</c> is a 400 too. Reading ignores case in property names and enum
/// values; writing is always camelCase.
/// </summary>
public static class ApiJson
{
    public static IServiceCollection AddApiJson(this IServiceCollection services) =>
        services.ConfigureHttpJsonOptions(options => Apply(options.SerializerOptions));

    public static void Apply(JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
        options.AllowDuplicateProperties = false;
        options.Converters.Add(new SingleValueEnumConverter());
    }
}
