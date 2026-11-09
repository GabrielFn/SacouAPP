using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;

namespace Sacou.Http;

/// <summary>
/// The JSON rules of every request body (ADR 0039): a field the DTO does not declare is a 400, against
/// mass assignment, and enums travel as camelCase text only, so <c>"role": 0</c> is a 400 too.
/// </summary>
public static class ApiJson
{
    public static IServiceCollection AddApiJson(this IServiceCollection services) =>
        services.ConfigureHttpJsonOptions(options => Apply(options.SerializerOptions));

    public static void Apply(JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
    }
}
