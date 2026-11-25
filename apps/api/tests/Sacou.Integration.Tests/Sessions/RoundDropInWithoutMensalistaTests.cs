using System.Net;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>R101 P3: the window is ignored when the only mensalista leaves the group (a removed member is not an active one).</summary>
public sealed class RoundDropInWithoutMensalistaTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int WindowHours = 24;
    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task RemovingTheOnlyMensalista_DropsTheWindow_AndTheEarlyVouPasses()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, regulars: true, dropInOpensHoursBefore: WindowHours);
        var round = (await RoundCalls.CreateAsync(world, RoundCalls.CreateBody()))["roundId"]!.GetValue<string>();
        var regularId = world.MemberIds[A.Scorekeeper];
        using var toRegular = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(regularId) + "/type", """{"memberType":"regular"}""");
        var withRegular = await RoundCalls.GetAsync(world, round);
        var blocked = await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true);

        using var removal = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.GroupPath}/members/{regularId}");
        var withoutRegular = await RoundCalls.GetAsync(world, round);
        var early = await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true);

        Assert.Equal(HttpStatusCode.OK, toRegular.StatusCode);
        Assert.NotNull(withRegular["dropInOpensAt"]);
        Assert.Equal("sessions.drop-in-window-closed", blocked.Code);
        Assert.True(removal.IsSuccessStatusCode);
        Assert.Null(withoutRegular["dropInOpensAt"]);
        Assert.Equal(HttpStatusCode.OK, early.Status);
        Assert.Equal("going", early.Body!["status"]!.GetValue<string>());
    }
}
