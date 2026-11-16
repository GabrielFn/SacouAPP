using System.Net;
using Sacou.Integration.Tests.Groups;
using Xunit;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>The draw route of E3.6 as a test calls it, and a round full of confirmed players to draw.</summary>
internal static class DrawCalls
{
    public const string DrawDisabled = "sessions.draw-disabled";
    public const string RoundClosed = "sessions.round-closed";
    public const string NoStore = "no-store";
    public const string EmptyBody = "{}";

    /// <summary>Room for the 14 of screen 07 and a few more.</summary>
    public const int Capacity = 20;

    public static string DrawPath(GroupWorld world, string roundId) => RoundCalls.RoundPath(world, roundId) + "/draw";

    public static string Together(Guid first, Guid second) =>
        $$"""{"locks":[{"first":"{{first}}","second":"{{second}}","kind":"together"}]}""";

    public static async Task<HttpResponseMessage> DrawAsync(GroupWorld world, string roundId, GroupActor actor = GroupActor.Admin, string body = EmptyBody) =>
        await world.SendAsync(actor, HttpMethod.Post, DrawPath(world, roundId), body);

    /// <summary>The draw on (and balanced, unless told), written through the Groups settings route as the admin.</summary>
    public static async Task EnableAsync(GroupWorld world, bool enabled = true, bool balance = true)
    {
        var patch = $$"""{"settings":{"schemaVersion":1,"draw":{"enabled":{{Flag(enabled)}},"balanceByLevel":{{Flag(balance)}} """ + "}}}";
        using var response = await world.SendAsync(GroupActor.Admin, HttpMethod.Patch, world.GroupPath + "/settings", patch);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>A round with attendance on and the draw on, its id.</summary>
    public static async Task<string> RoundAsync(GroupWorld world, bool balance = true)
    {
        await RoundCalls.ConfigureAttendanceAsync(world, Capacity);
        await EnableAsync(world, balance: balance);
        return (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
    }

    /// <summary>The admin confirms each member, in this order: the order of arrival.</summary>
    public static async Task ConfirmAsync(GroupWorld world, string roundId, IEnumerable<Guid> members)
    {
        foreach (var member in members)
        {
            Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, roundId, member, going: true));
        }
    }

    /// <summary>The four active actors and <paramref name="extra"/> new players, confirmed in that order.</summary>
    public static async Task<IReadOnlyList<Guid>> ConfirmPlayersAsync(GroupWorld world, string roundId, int extra)
    {
        List<Guid> members =
        [
            world.MemberIds[GroupActor.Admin],
            world.MemberIds[GroupActor.CoAdmin],
            world.MemberIds[GroupActor.Scorekeeper],
            world.MemberIds[GroupActor.Player],
        ];
        for (var added = 0; added < extra; added++)
        {
            members.Add((await world.AddPersonAsync()).MemberId);
        }

        await ConfirmAsync(world, roundId, members);
        return members;
    }

    private static string Flag(bool on) => on ? "true" : "false";
}
