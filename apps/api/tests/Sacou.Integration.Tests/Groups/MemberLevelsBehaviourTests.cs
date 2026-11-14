using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Integration.Tests.Identity;
using Sacou.Modules.Groups.Contracts;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>P2 of E3.17: the list, the body of the writes, the targets that left, and the contract for the draw (ADR 0051).</summary>
public sealed class MemberLevelsBehaviourTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int BodyCap = 4 * 1024;
    private const int MaxBatch = 50;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>One item per active member in the order they joined: pending, "Não sei" and a level, with the suggestion of the profile.</summary>
    [Fact]
    public async Task List_ShowsPendingDontKnowAndLevel_WithTheSuggestion()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var suggested = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(level: "4.5"));
        using var dontKnow = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.Scorekeeper], "null");
        using var level = await LevelCalls.SetAsync(world, A.CoAdmin, world.MemberIds[A.Player], "3.5");

        using var response = await world.SendAsync(A.Admin, HttpMethod.Get, LevelCalls.ListPath(world));
        var items = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsArray();

        Assert.Equal(
            [world.MemberIds[A.Admin], world.MemberIds[A.CoAdmin], world.MemberIds[A.Scorekeeper], world.MemberIds[A.Player]],
            items.Select(item => item!["memberId"]!.GetValue<Guid>()));
        Assert.Equal("""{"adminLevel":null,"reviewed":false,"suggestedLevel":null}""", Without(items[0]!, "memberId"));
        Assert.Equal("""{"adminLevel":null,"reviewed":true,"suggestedLevel":null}""", Without(items[2]!, "memberId"));
        Assert.Equal("""{"adminLevel":3.5,"reviewed":true,"suggestedLevel":4.5}""", Without(items[3]!, "memberId"));
    }

    [Fact]
    public async Task Writes_AnswerTheLevelAsStored_AndTheBatchInTheOrderAsked()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var player = world.MemberIds[A.Player];
        var admin = world.MemberIds[A.Admin];

        using var single = await LevelCalls.SetAsync(world, A.Admin, player, "45e-1");
        using var batch = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), LevelCalls.Batch((player, "2"), (admin, "null")));

        Assert.Equal($$"""{"memberId":"{{player}}","adminLevel":4.5,"reviewed":true}""", await single.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(
            $$"""[{"memberId":"{{player}}","adminLevel":2,"reviewed":true},{"memberId":"{{admin}}","adminLevel":null,"reviewed":true}]""",
            await batch.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(new LevelState(20, admin), await LevelCalls.ReadAsync(api.ConnectionString, player));
        Assert.Equal(new LevelState(null, admin), await LevelCalls.ReadAsync(api.ConnectionString, admin));
    }

    [Theory]
    [InlineData("4.25")]
    [InlineData("6")]
    [InlineData("0")]
    [InlineData("0.5")]
    [InlineData("5.5")]
    [InlineData("-0")]
    [InlineData("\"4\"")]
    [InlineData("true")]
    [InlineData("1e400")]
    public async Task LevelOffTheScaleOrNotANumber_Is400_AndWritesNothing(string level)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var single = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.Player], level);
        using var batch = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), LevelCalls.Batch((world.MemberIds[A.Player], level)));

        Assert.Equal(HttpStatusCode.BadRequest, single.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, batch.StatusCode);
        Assert.Equal(0, await LevelCalls.CountAsync(api.ConnectionString, world.GroupId));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"level":3,"memberId":"0193a0b0-0000-7000-8000-000000000000"}""")]
    [InlineData("""{"level":3,"groupId":"0193a0b0-0000-7000-8000-000000000000"}""")]
    [InlineData("""{"level":3,"setBy":"0193a0b0-0000-7000-8000-000000000000"}""")]
    [InlineData("""{"level":3,"LEVEL":4}""")]
    public async Task MissingOrExtraField_Is400(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.MemberPath(world, world.MemberIds[A.Player]), json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await LevelCalls.CountAsync(api.ConnectionString, world.GroupId));
    }

    [Theory]
    [InlineData("""{"levels":[]}""")]
    [InlineData("""{"levels":null}""")]
    [InlineData("""{"levels":[null]}""")]
    public async Task EmptyOrNullBatch_IsLevelInvalid(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(LevelCalls.LevelInvalid, await SettingsCalls.CodeAsync(response));
    }

    /// <summary>Fifty items fit in the 4 KB cap and pass; fifty-one are refused by the rule; a body over the cap never reaches it.</summary>
    [Fact]
    public async Task Batch_OfFiftyFits_FiftyOneIsInvalid_AndOverTheCapIs413()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var targets = new List<Guid>();
        for (var index = 0; index <= MaxBatch; index++)
        {
            targets.Add(await world.AddMemberAsync("player"));
        }

        var fifty = LevelCalls.Batch([.. targets.Take(MaxBatch).Select(target => (target, "null"))]);
        var fiftyOne = LevelCalls.Batch([.. targets.Select(target => (target, "4.5"))]);
        var repeated = LevelCalls.Batch((targets[0], "4.5"), (targets[0], "3"));
        using var full = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), fifty);
        using var tooMany = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), fiftyOne);
        using var twice = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), repeated);
        using var huge = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), fifty.Replace("]}", $$"""],"padding":"{{new string('x', BodyCap)}}"}""", StringComparison.Ordinal));

        Assert.True(fifty.Length < BodyCap);
        Assert.Equal(HttpStatusCode.OK, full.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
        Assert.Equal(LevelCalls.LevelInvalid, await SettingsCalls.CodeAsync(tooMany));
        Assert.Equal(LevelCalls.LevelInvalid, await SettingsCalls.CodeAsync(twice));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, huge.StatusCode);
        Assert.Equal(MaxBatch, await LevelCalls.CountAsync(api.ConnectionString, world.GroupId));
        Assert.Equal(new LevelState(null, world.MemberIds[A.Admin]), await LevelCalls.ReadAsync(api.ConnectionString, targets[MaxBatch - 1]));
    }

    /// <summary>A target who left is 404; the level stays in the table and shows again when the same member comes back by the link.</summary>
    [Fact]
    public async Task TargetWhoLeft_IsNotFound_AndKeepsTheLevelForTheReturn()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var player = world.MemberIds[A.Player];
        using var before = await LevelCalls.SetAsync(world, A.Admin, player, "4");
        using var left = await world.SendAsync(A.Player, HttpMethod.Post, world.GroupPath + "/leave");

        using var refused = await LevelCalls.SetAsync(world, A.Admin, player, "2");
        var whileAway = await LevelCalls.ListAsync(world);
        using var back = await world.SendAsync(A.Player, HttpMethod.Post, GroupWorld.AcceptPath, GroupWorld.TokenBody(world.Invite.Token));
        var afterReturn = await LevelCalls.ListAsync(world);

        Assert.Equal(HttpStatusCode.NotFound, refused.StatusCode);
        Assert.Equal(LevelCalls.MemberNotFound, await SettingsCalls.CodeAsync(refused));
        Assert.DoesNotContain(player, whileAway.Keys);
        Assert.Equal((short)40, (await LevelCalls.ReadAsync(api.ConnectionString, player))!.Tenths);
        Assert.True(back.IsSuccessStatusCode);
        Assert.Equal(4m, afterReturn[player]["adminLevel"]!.GetValue<decimal>());
    }

    [Fact]
    public async Task RemovedTarget_IsNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.RemovedMember], "3");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(LevelCalls.MemberNotFound, await SettingsCalls.CodeAsync(response));
        Assert.Null(await LevelCalls.ReadAsync(api.ConnectionString, world.MemberIds[A.RemovedMember]));
    }

    /// <summary>The contract for the draw: the admin's level, else the suggestion, else 3,0; ids of another group are absent.</summary>
    [Fact]
    public async Task Contract_ResolvesEachMemberOfTheGroup()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var suggestedByPlayer = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(level: "2.0"));
        using var suggestedByScorekeeper = await world.SendAsync(A.Scorekeeper, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(level: "4.5"));
        using var adminLevel = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.CoAdmin], "3.5");
        using var dontKnow = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.Scorekeeper], "null");
        Guid[] asked = [world.MemberIds[A.Admin], world.MemberIds[A.CoAdmin], world.MemberIds[A.Scorekeeper], world.MemberIds[A.Player], world.MemberIds[A.OutsiderMember]];

        await using var scope = api.Services.CreateAsyncScope();
        var levels = scope.ServiceProvider.GetRequiredService<IMemberLevels>();
        var resolved = await levels.ResolveAsync(world.GroupId, asked, TestContext.Current.CancellationToken);
        var missing = await levels.ResolveAsync(Guid.NewGuid(), asked, TestContext.Current.CancellationToken);

        Assert.Equal(
            [
                new ResolvedLevel(world.MemberIds[A.Admin], 30, LevelSource.Default),
                new ResolvedLevel(world.MemberIds[A.CoAdmin], 35, LevelSource.Admin),
                new ResolvedLevel(world.MemberIds[A.Scorekeeper], 45, LevelSource.Suggested),
                new ResolvedLevel(world.MemberIds[A.Player], 20, LevelSource.Suggested),
            ],
            resolved);
        Assert.Empty(missing);
    }

    private static string Without(JsonNode item, string field)
    {
        var copy = item.DeepClone().AsObject();
        Assert.True(copy.Remove(field));
        return copy.ToJsonString();
    }
}
