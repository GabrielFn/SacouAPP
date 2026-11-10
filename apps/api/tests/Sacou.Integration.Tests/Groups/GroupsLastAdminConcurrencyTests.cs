using System.Net;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// C1 to C3 of E3.2: two admins racing never leave the group without an admin (group lock, ADR 0040, D8).
/// Each round is a new group with exactly two admins, the founder and the co-admin made admin; both calls
/// are released together by a barrier.
/// </summary>
public sealed class GroupsLastAdminConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Rounds = 5;

    /// <summary>The two orders of C3, as the sorted statuses: demotion first, or leave first.</summary>
    private static readonly string[] DemotionOrLeaveFirst = ["OK,NoContent", "NoContent,NotFound"];

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>
    /// C1: each demotes the other; exactly one wins. The loser is judged under the lock as what they now
    /// are, a player, so the answer is 403 <c>groups.forbidden</c>, not 409: the role check comes first.
    /// </summary>
    [Fact]
    public async Task TwoAdminsDemotingEachOther_LeaveOneAdmin()
    {
        for (var round = 0; round < Rounds; round++)
        {
            var (world, statuses) = await RaceAsync(
                world => (HttpMethod.Put, world.MemberPath(world.MemberIds[A.CoAdmin]) + "/role", """{"role":"player"}"""),
                world => (HttpMethod.Put, world.MemberPath(world.MemberIds[A.Admin]) + "/role", """{"role":"player"}"""));

            Assert.Equal([HttpStatusCode.OK, HttpStatusCode.Forbidden], statuses.Order());
            Assert.Equal(1, await MemberRows.CountActiveAdminsAsync(api.ConnectionString, world.GroupId));
        }
    }

    /// <summary>C2: both leave; exactly one goes.</summary>
    [Fact]
    public async Task TwoAdminsLeaving_LeaveOneAdmin()
    {
        for (var round = 0; round < Rounds; round++)
        {
            var (world, statuses) = await RaceAsync(
                world => (HttpMethod.Post, world.GroupPath + "/leave", null),
                world => (HttpMethod.Post, world.GroupPath + "/leave", null));

            Assert.Equal([HttpStatusCode.NoContent, HttpStatusCode.Conflict], statuses.Order());
            Assert.Equal(1, await MemberRows.CountActiveAdminsAsync(api.ConnectionString, world.GroupId));
        }
    }

    /// <summary>
    /// C3: one demotes the other while the other leaves. Demotion first: the player leaves (200, 204). Leave
    /// first: the demotion finds nobody (204, 404). Either way one admin is left.
    /// </summary>
    [Fact]
    public async Task DemotionWhileTheOtherLeaves_NeverLeavesNoAdmin()
    {
        for (var round = 0; round < Rounds; round++)
        {
            var (world, statuses) = await RaceAsync(
                world => (HttpMethod.Put, world.MemberPath(world.MemberIds[A.CoAdmin]) + "/role", """{"role":"player"}"""),
                world => (HttpMethod.Post, world.GroupPath + "/leave", null));

            Assert.Contains(string.Join(',', statuses.Order()), DemotionOrLeaveFirst);
            Assert.Equal(1, await MemberRows.CountActiveAdminsAsync(api.ConnectionString, world.GroupId));
        }
    }

    /// <summary>C3, the dangerous order: one demotes themselves while the other leaves. Each alone is fine; together, one gets 409.</summary>
    [Fact]
    public async Task SelfDemotionWhileTheOtherLeaves_LeavesOneAdmin()
    {
        for (var round = 0; round < Rounds; round++)
        {
            var (world, statuses) = await RaceAsync(
                world => (HttpMethod.Put, world.MemberPath(world.MemberIds[A.Admin]) + "/role", """{"role":"coAdmin"}"""),
                world => (HttpMethod.Post, world.GroupPath + "/leave", null));

            Assert.Single(statuses, status => status == HttpStatusCode.Conflict);
            Assert.Equal(1, await MemberRows.CountActiveAdminsAsync(api.ConnectionString, world.GroupId));
        }
    }

    /// <summary>The founder sends the first request and the second admin the other, at the same time.</summary>
    private async Task<(GroupWorld World, HttpStatusCode[] Statuses)> RaceAsync(
        Func<GroupWorld, (HttpMethod Method, string Path, string? Json)> founder,
        Func<GroupWorld, (HttpMethod Method, string Path, string? Json)> second)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await MemberRows.SetRoleAsync(api.ConnectionString, world.MemberIds[A.CoAdmin], "admin");
        using var gate = new Barrier(2);
        var calls = new[] { (A.Admin, founder(world)), (A.CoAdmin, second(world)) }.Select(async call =>
        {
            await Task.Yield();
            gate.SignalAndWait(TestContext.Current.CancellationToken);
            var (method, path, json) = call.Item2;
            using var response = await world.SendAsync(call.Item1, method, path, json);
            return response.StatusCode;
        });
        return (world, await Task.WhenAll(calls));
    }
}
