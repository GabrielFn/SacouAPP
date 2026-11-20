using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;

namespace Sacou.Integration.Tests.Stats;

/// <summary>The two read routes of the Stats (E3.9 part 4b): the summary of a round and the person's own season.</summary>
internal static class StatsCalls
{
    public const string MyStatsPath = "/v1/me/stats";

    public static string SummaryPath(GroupWorld world, string roundId) => $"{RoundCalls.RoundPath(world, roundId)}/summary";

    /// <summary>The summary, which must be a 200: the read that rebuilds a stale round.</summary>
    public static async Task<JsonObject> SummaryAsync(GroupWorld world, GroupActor actor, string roundId)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, SummaryPath(world, roundId));
        return await OkAsync(response);
    }

    public static async Task<JsonObject> MyStatsAsync(GroupWorld world, GroupActor actor, string? year = null)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, year is null ? MyStatsPath : $"{MyStatsPath}?year={year}");
        return await OkAsync(response);
    }

    private static async Task<JsonObject> OkAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        return JsonNode.Parse(body)!.AsObject();
    }
}
