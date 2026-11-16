using System.Diagnostics;
using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Identity;

/// <summary>E1 to E7, B1 and L1 of E3.16 part 1 (ADR 0056): the export and the deletion blockers, on a real Postgres.</summary>
public sealed class AccountDataTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string ExportPath = "/v1/me/export";
    private const string BlockersPath = "/v1/me/deletion-blockers";
    private const string PersonNickname = "Caiozinho";
    private const string OtherNickname = "Outrinho";
    private const string SecondGroupName = "Racha que eu saí";
    private const string AdminNote = "4.5";
    private const double AdminNoteValue = 4.5;
    private const int VolumeGroups = 100;
    private const int VolumeRoundsPerGroup = 20;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>E1: profile, two memberships (one active, one left), attendances in both, sorted, version 1.</summary>
    [Fact]
    public async Task Export_HasTheProfileTheGroupsAndTheAttendances()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var scenario = await ScenarioAsync(world);

        var (response, document) = await ExportAsync(world, A.Player);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("sacou-personal-data", document["format"]!.GetValue<string>());
        Assert.Equal(1, document["version"]!.GetValue<int>());
        Assert.Equal(["format", "version", "generatedAt", "account", "profile", "groups", "attendances"], document.Select(pair => pair.Key));
        Assert.NotNull(document["account"]!["createdAt"]);
        Assert.Equal(
            $$"""{"nickname":"{{PersonNickname}}","primaryPosition":"setter","otherPositions":["libero"],"suggestedLevel":2}""",
            document["profile"]!.ToJsonString());

        var groups = document["groups"]!.AsArray().Select(item => item!.AsObject()).ToList();
        Assert.Equal([world.GroupId, scenario.SecondGroupId], groups.Select(group => group["groupId"]!.GetValue<Guid>()));
        Assert.Equal("Racha da matriz", groups[0]["groupName"]!.GetValue<string>());
        Assert.Equal(world.MemberIds[A.Player], groups[0]["memberId"]!.GetValue<Guid>());
        Assert.Equal("player", groups[0]["role"]!.GetValue<string>());
        Assert.Equal("dropIn", groups[0]["memberType"]!.GetValue<string>());
        Assert.Equal("active", groups[0]["status"]!.GetValue<string>());
        Assert.Null(groups[0]["leftAt"]);
        Assert.Null(groups[1]["groupName"]);
        Assert.Equal("admin", groups[1]["role"]!.GetValue<string>());
        Assert.Equal("left", groups[1]["status"]!.GetValue<string>());
        Assert.NotNull(groups[1]["leftAt"]);

        var attendances = document["attendances"]!.AsArray().Select(item => item!.AsObject()).ToList();
        Assert.Equal([scenario.FirstRoundId, scenario.SecondRoundId], attendances.Select(item => item["roundId"]!.GetValue<Guid>()));
        Assert.Equal([world.GroupId, scenario.SecondGroupId], attendances.Select(item => item["groupId"]!.GetValue<Guid>()));
        Assert.Equal([world.MemberIds[A.Player], scenario.SecondMemberId], attendances.Select(item => item["memberId"]!.GetValue<Guid>()));
        Assert.All(attendances, item => Assert.Equal("going", item["status"]!.GetValue<string>()));
        Assert.All(attendances, item => Assert.Equal("self", item["source"]!.GetValue<string>()));
        Assert.All(attendances, item => Assert.False(string.IsNullOrEmpty(item["timeZone"]!.GetValue<string>())));
        Assert.Equal("20:30:00", attendances[0]["localTime"]!.GetValue<string>());
    }

    /// <summary>E2: a person who never saved a profile nor joined a group gets the header and empty sections.</summary>
    [Fact]
    public async Task Export_OfANewPerson_HasNoProfileAndEmptyLists()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        var (response, document) = await ExportAsync(world, A.NonMember);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(document["profile"]);
        Assert.Empty(document["groups"]!.AsArray());
        Assert.Empty(document["attendances"]!.AsArray());
    }

    /// <summary>E3: the admin's note about the person never leaves the API (question 42); the person's own suggestion does.</summary>
    [Fact]
    public async Task Export_NeverHasTheAdminsNote()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await ScenarioAsync(world);
        Assert.Equal(AdminNoteValue, (await LevelCalls.ListAsync(world))[world.MemberIds[A.Player]]["adminLevel"]!.GetValue<double>());

        var (_, document) = await ExportAsync(world, A.Player);

        Assert.DoesNotContain(Walk(document), node => node is JsonValue value && value.TryGetValue<double>(out var number) && number == AdminNoteValue);
        Assert.DoesNotContain(Keys(document), key => key is "level" or "levelTenths" or "setByMemberId");
        Assert.Equal(2, document["profile"]!["suggestedLevel"]!.GetValue<double>());
    }

    /// <summary>E4: nothing about another person, and none of the person's internal keys.</summary>
    [Fact]
    public async Task Export_HasNoOneElsesDataNorInternalKeys()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await ScenarioAsync(world);

        var (response, document) = await ExportAsync(world, A.Player);
        var text = document.ToJsonString();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain(OtherNickname, text, StringComparison.Ordinal);
        Assert.DoesNotContain(world.MemberIds[A.Admin].ToString(), text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(world.Users[A.Player].ToString(), text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(world.Subjects[A.Player], text, StringComparison.Ordinal);
        Assert.DoesNotContain(SecondGroupName, text, StringComparison.Ordinal);
        Assert.DoesNotContain("Quadra 3", text, StringComparison.Ordinal);
        Assert.DoesNotContain(Keys(document), key => key is "userId" or "firebaseUid" or "venue");
    }

    /// <summary>E5: a file to share, never cached, named by the day only.</summary>
    [Fact]
    public async Task Export_IsAnAttachmentThatIsNeverCached()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var day = DateOnly.FromDateTime(api.Clock.GetUtcNow().UtcDateTime).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

        using var response = await world.SendAsync(A.Player, HttpMethod.Get, ExportPath);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("utf-8", response.Content.Headers.ContentType?.CharSet);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal($"sacou-meus-dados-{day}.json", response.Content.Headers.ContentDisposition?.FileName);
    }

    /// <summary>E6 and the matrix of B1: 401 without a token, 403 before <c>POST /v1/me</c>, never cached either.</summary>
    [Theory]
    [InlineData(ExportPath, A.Anonymous, 401, null)]
    [InlineData(ExportPath, A.Unregistered, 403, "identity.user-not-registered")]
    [InlineData(BlockersPath, A.Anonymous, 401, null)]
    [InlineData(BlockersPath, A.Unregistered, 403, "identity.user-not-registered")]
    public async Task Refusals(string path, A actor, int status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(actor, HttpMethod.Get, path);

        Assert.Equal((HttpStatusCode)status, response.StatusCode);
        Assert.Equal(code, await RoundCalls.CodeAsync(response));
        Assert.Null(response.Content.Headers.ContentDisposition);
    }

    /// <summary>E7: 100 memberships with 20 rounds each answer in one go; the size goes to the PR.</summary>
    [Fact]
    public async Task Export_OfAHeavyUser_AnswersWhole()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (subject, user) = await world.RegisterPersonAsync();
        await SeedVolumeAsync(user);
        var clock = Stopwatch.StartNew();

        using var response = await world.SendAsAsync(subject, HttpMethod.Get, ExportPath);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        clock.Stop();
        var document = JsonNode.Parse(text)!.AsObject();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(VolumeGroups, document["groups"]!.AsArray().Count);
        Assert.Equal(VolumeGroups * VolumeRoundsPerGroup, document["attendances"]!.AsArray().Count);
        TestContext.Current.TestOutputHelper?.WriteLine($"E7: {text.Length} characters in {clock.ElapsedMilliseconds} ms.");
    }

    /// <summary>B1: the groups where the person is the only admin and someone could take over, by name, never cached.</summary>
    [Fact]
    public async Task Blockers_ListTheGroupsToHandOver()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var alpha = await world.CreateGroupAsync(A.Admin, "Alfa");
        await world.InsertMemberAsync(A.Player, "player", "active", alpha);
        await world.CreateGroupAsync(A.Admin, "Sozinho");
        var guests = await world.CreateGroupAsync(A.Admin, "Só convidados");
        await AddGuestAsync(world, guests);
        var shared = await world.CreateGroupAsync(A.Admin, "Dois admins");
        await world.InsertMemberAsync(A.CoAdmin, "admin", "active", shared);
        var formers = await world.CreateGroupAsync(A.Admin, "Ex-membros");
        await world.InsertMemberAsync(A.Player, "player", "left", formers);
        var coAdmin = await world.CreateGroupAsync(A.Admin, "Com co-admin");
        await world.InsertMemberAsync(A.Scorekeeper, "co_admin", "active", coAdmin);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Get, BlockersPath);
        var body = await RoundCalls.JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Equal(
            JsonNode.Parse($$"""
                {"blockers":[
                {"groupId":"{{alpha}}","groupName":"Alfa","kind":"lastAdmin"},
                {"groupId":"{{coAdmin}}","groupName":"Com co-admin","kind":"lastAdmin"},
                {"groupId":"{{world.GroupId}}","groupName":"Racha da matriz","kind":"lastAdmin"}]}
                """)!.ToJsonString(),
            body.ToJsonString());
    }

    /// <summary>B1: nothing blocks a player, nor an admin who shares the role (the left admin of the world is no admin).</summary>
    [Theory]
    [InlineData(A.Player)]
    [InlineData(A.CoAdmin)]
    [InlineData(A.LeftMember)]
    [InlineData(A.NonMember)]
    public async Task Blockers_AreEmptyForWhoeverIsNotTheLastAdmin(A actor)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(actor, HttpMethod.Get, BlockersPath);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("""{"blockers":[]}""", (await RoundCalls.JsonAsync(response)).ToJsonString());
    }

    /// <summary>L1 of E3.16: no log line of these routes carries a nickname, a subject, a user id, a member id or a group name.</summary>
    [Fact]
    public async Task Logs_CarryNothingPersonal()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await ScenarioAsync(world);
        var start = api.Logs.Count;

        using var export = await world.SendAsync(A.Player, HttpMethod.Get, ExportPath);
        using var blockers = await world.SendAsync(A.Admin, HttpMethod.Get, BlockersPath);
        using var refused = await world.SendAsync(A.Unregistered, HttpMethod.Get, ExportPath);

        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        var entries = api.Logs.EntriesSince(start);
        Assert.Contains(entries, entry => entry.Contains("Account export generated.", StringComparison.Ordinal));
        string[] forbidden =
        [
            PersonNickname, OtherNickname, "Racha da matriz", SecondGroupName, world.Subjects[A.Player], world.Subjects[A.Unregistered],
            world.Users[A.Player].ToString(), world.Users[A.Admin].ToString(), world.MemberIds[A.Player].ToString(), world.GroupId.ToString(),
        ];
        Assert.DoesNotContain(entries, entry => forbidden.Any(secret => entry.Contains(secret, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>
    /// The person (the world's player) with a profile and an attendance in the world's round; the admin with a
    /// profile, an attendance in the same round and a note about the person; a second group the person founded,
    /// answered a round in, and then left.
    /// </summary>
    private async Task<Scenario> ScenarioAsync(GroupWorld world)
    {
        await PutProfileAsync(world, A.Player, ProfileRows.Body(nickname: PersonNickname, level: "2"));
        await PutProfileAsync(world, A.Admin, ProfileRows.Body(nickname: OtherNickname, level: "5"));
        await RoundCalls.ConfigureAttendanceAsync(world);
        var first = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(RoundCalls.FutureDate(3)));
        var firstRound = first["roundId"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, world.Subjects[A.Player], firstRound, going: true)).Status);
        Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, world.Subjects[A.Admin], firstRound, going: true)).Status);
        using var note = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.Player], AdminNote);
        Assert.Equal(HttpStatusCode.OK, note.StatusCode);

        var second = await world.CreateGroupAsync(A.Player, SecondGroupName);
        var secondPath = $"{GroupWorld.GroupsPath}/{second}";
        using var settings = await world.SendAsync(A.Player, HttpMethod.Patch, secondPath + "/settings",
            """{"settings":{"schemaVersion":1,"attendance":{"enabled":true,"capacityLimited":true,"capacity":12,"waitlistEnabled":true,"regularsEnabled":false}}}""");
        Assert.Equal(HttpStatusCode.OK, settings.StatusCode);
        using var created = await world.SendAsync(A.Player, HttpMethod.Post, secondPath + "/rounds", RoundCalls.CreateBody(RoundCalls.FutureDate(5)));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var secondRound = (await RoundCalls.JsonAsync(created))["roundId"]!.GetValue<string>();
        using var answered = await world.SendAsync(A.Player, HttpMethod.Put, $"{secondPath}/rounds/{secondRound}/attendance/me", RoundCalls.Response(going: true));
        Assert.Equal(HttpStatusCode.OK, answered.StatusCode);
        var secondMember = await LeaveByHandAsync(second);
        return new Scenario(Guid.Parse(firstRound), second, Guid.Parse(secondRound), secondMember);
    }

    private static async Task PutProfileAsync(GroupWorld world, A actor, string body)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Put, ProfileRows.ProfilePath, body);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task AddGuestAsync(GroupWorld world, Guid group)
    {
        using var response = await world.SendAsync(A.Admin, HttpMethod.Post, $"{GroupWorld.GroupsPath}/{group}/guests", GuestCalls.AddBody(Guid.NewGuid(), "Léo"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    /// <summary>The founder of <paramref name="group"/> marked as left by hand: alone, the leave route would refuse the last admin.</summary>
    private async Task<Guid> LeaveByHandAsync(Guid group)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var update = new NpgsqlCommand(
            "UPDATE groups.members SET status = 'left', left_at = now() WHERE group_id = @group RETURNING id", connection);
        update.Parameters.AddWithValue("group", group);
        return (Guid)(await update.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    /// <summary>E7's person: 100 groups, each with the person and 20 rounds the person answered, written straight to the tables.</summary>
    private async Task SeedVolumeAsync(Guid user)
    {
        var groups = Enumerable.Range(0, VolumeGroups).Select(index => (Group: Guid.CreateVersion7(), Member: Guid.CreateVersion7(), Index: index)).ToList();
        var rounds = groups.SelectMany(group => Enumerable.Range(0, VolumeRoundsPerGroup)
            .Select(index => (Round: Guid.CreateVersion7(), group.Group, group.Member, Day: (group.Index * VolumeRoundsPerGroup) + index))).ToList();
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var seed = new NpgsqlCommand(
            """
            INSERT INTO groups.groups (id, name, created_at)
                SELECT id, 'Volume ' || ord, now() FROM unnest(@groups::uuid[]) WITH ORDINALITY AS g(id, ord);
            INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at, left_at)
                SELECT member, grp, @user, 'player', 'drop_in', 'active', now() + ord * interval '1 second', NULL
                FROM unnest(@members::uuid[], @groups::uuid[]) WITH ORDINALITY AS m(member, grp, ord);
            INSERT INTO sessions.rounds (id, group_id, local_date, local_time, time_zone, starts_at, venue, status, next_sequence, created_at)
                SELECT round, grp, DATE '2030-01-01' + day, TIME '20:30', 'America/Sao_Paulo', now(), 'Quadra', 'scheduled', 2, now()
                FROM unnest(@rounds::uuid[], @roundGroups::uuid[], @days::int[]) AS r(round, grp, day);
            INSERT INTO sessions.attendances (round_id, member_id, status, sequence, source, responded_at, promoted_at)
                SELECT round, member, 'going', 1, 'self', now(), NULL FROM unnest(@rounds::uuid[], @roundMembers::uuid[]) AS a(round, member);
            """,
            connection);
        seed.Parameters.AddWithValue("groups", groups.Select(group => group.Group).ToArray());
        seed.Parameters.AddWithValue("members", groups.Select(group => group.Member).ToArray());
        seed.Parameters.AddWithValue("user", user);
        seed.Parameters.AddWithValue("rounds", rounds.Select(round => round.Round).ToArray());
        seed.Parameters.AddWithValue("roundGroups", rounds.Select(round => round.Group).ToArray());
        seed.Parameters.AddWithValue("roundMembers", rounds.Select(round => round.Member).ToArray());
        seed.Parameters.AddWithValue("days", rounds.Select(round => round.Day).ToArray());
        await seed.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<(HttpResponseMessage Response, JsonObject Document)> ExportAsync(GroupWorld world, A actor)
    {
        var response = await world.SendAsync(actor, HttpMethod.Get, ExportPath);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return (response, JsonNode.Parse(text)!.AsObject());
    }

    private static IEnumerable<JsonNode> Walk(JsonNode? node) => node switch
    {
        JsonObject item => item.SelectMany(pair => Walk(pair.Value)).Prepend(item),
        JsonArray items => items.SelectMany(Walk).Prepend(items),
        JsonValue value when value.GetValueKind() != JsonValueKind.Null => [value],
        _ => [],
    };

    private static IEnumerable<string> Keys(JsonNode node) =>
        Walk(node).OfType<JsonObject>().SelectMany(item => item.Select(pair => pair.Key));

    private sealed record Scenario(Guid FirstRoundId, Guid SecondGroupId, Guid SecondRoundId, Guid SecondMemberId);
}
