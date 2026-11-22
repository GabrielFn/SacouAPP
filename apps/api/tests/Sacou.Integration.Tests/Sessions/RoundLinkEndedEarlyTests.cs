using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Matches;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>ADR 0076: a round ended before its start no longer takes answers by the link, and the public page says it started.</summary>
public sealed class RoundLinkEndedEarlyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task ARoundEndedEarly_IsClosedForTheLink_AndThePage()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var created = await RoundCalls.CreateAsync(world);
        var round = created["roundId"]!.GetValue<string>();
        var code = RoundLinkCalls.CodeOf(created);
        api.Clock.SetNow(created["startsAt"]!.GetValue<DateTimeOffset>().AddHours(-1));
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a"), phone.ManualEnd("a")]);
        using var closed = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        Assert.Equal(HttpStatusCode.OK, closed.StatusCode);

        using var page = await client.GetAsync($"/r/{code}", TestContext.Current.CancellationToken);
        var html = await page.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.Player, code);

        Assert.Contains("Essa rodada já terminou.", html, StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.Equal(RoundLinkCalls.RoundClosed, RoundLinkCalls.Code(body));
    }
}
