using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// E6.6, criteria 15 and 16 and question 234 on a real Postgres: the account erasure deletes the reports by and about
/// the person (the deletion route and the reapply after a restore), the others stay, and the sweep deletes the old ones.
/// </summary>
public sealed class ContentReportsRetentionTests(IntegrationDatabase database) : IAsyncLifetime
{
    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task AccountDeletion_DeletesTheReportsByAndAboutThePerson()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await ReportAllAsync(world);

        using var deleted = await world.DeleteAccountAsync(A.Player);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        AssertOnlyTheOthersStay(world, await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
    }

    [Fact]
    public async Task ErasureAfterRestore_DeletesTheReportsByAndAboutThePerson()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await ReportAllAsync(world);

        using (var scope = api.Services.CreateScope())
        {
            foreach (var erasure in scope.ServiceProvider.GetServices<IAccountErasure>())
            {
                _ = await erasure.EraseAsync(world.Users[A.Player], ErasureMode.AfterRestore, TestContext.Current.CancellationToken);
            }
        }

        AssertOnlyTheOthersStay(world, await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
    }

    /// <summary>Question 234: 180 days. One of 179 days stays, one of 181 goes; the group's report is no exception.</summary>
    [Fact]
    public async Task Sweep_DeletesTheReportsOlderThan180Days()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using (var young = await ReportCalls.ReportAsync(world, A.Player, world.MemberIds[A.Scorekeeper]))
        using (var old = await ReportCalls.ReportAsync(world, A.Player, world.MemberIds[A.CoAdmin]))
        {
            Assert.Equal(HttpStatusCode.NoContent, young.StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, old.StatusCode);
        }

        await ReportCalls.AgeAsync(api.ConnectionString, world.GroupId, world.MemberIds[A.Scorekeeper], TimeSpan.FromDays(179));
        await ReportCalls.AgeAsync(api.ConnectionString, world.GroupId, world.MemberIds[A.CoAdmin], TimeSpan.FromDays(181));

        using (var scope = api.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IContentReportRetention>().CleanUpAsync(DateTimeOffset.UtcNow, TestContext.Current.CancellationToken);
        }

        var row = Assert.Single(await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
        Assert.Equal(world.MemberIds[A.Scorekeeper], row.Reported);
    }

    /// <summary>The player reports the admin and the group; the scorekeeper reports the player; the co-admin reports the admin.</summary>
    private static async Task ReportAllAsync(GroupWorld world)
    {
        HttpResponseMessage[] responses =
        [
            await ReportCalls.ReportAsync(world, A.Player, world.MemberIds[A.Admin]),
            await ReportCalls.ReportAsync(world, A.Player, null),
            await ReportCalls.ReportAsync(world, A.Scorekeeper, world.MemberIds[A.Player]),
            await ReportCalls.ReportAsync(world, A.CoAdmin, world.MemberIds[A.Admin]),
        ];
        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            response.Dispose();
        }
    }

    private static void AssertOnlyTheOthersStay(GroupWorld world, IReadOnlyList<ReportRow> rows)
    {
        var row = Assert.Single(rows);
        Assert.Equal(world.MemberIds[A.CoAdmin], row.Reporter);
        Assert.Equal(world.MemberIds[A.Admin], row.Reported);
    }
}
