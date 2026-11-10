using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>M10 to M14, P6, L1 and L2 of E3.2 part 3, on the real API and a real Postgres.</summary>
public sealed class GroupsInviteTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string InviteInvalid = "groups.invite-invalid";
    private const string TraceIdField = "traceId";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>M14: the whole life of one person and one link.</summary>
    [Fact]
    public async Task Acceptance_JoinAgainLeaveReturnRemoved()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var accept = GroupWorld.TokenBody(world.Invite.Token);

        var joined = await JsonAsync(world, A.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, accept, HttpStatusCode.Created);
        var memberId = joined["memberId"]!.GetValue<Guid>();
        var listed = (await ArrayAsync(world, A.Admin, world.GroupPath + "/members")).Single(member => member!["memberId"]!.GetValue<Guid>() == memberId)!;
        var again = await JsonAsync(world, A.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, accept, HttpStatusCode.OK);
        var useAfterAgain = await UseCountAsync(world);
        using var left = await world.SendAsync(A.NonMember, HttpMethod.Post, world.GroupPath + "/leave");
        var back = await JsonAsync(world, A.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, accept, HttpStatusCode.Created);
        using var removed = await world.SendAsync(A.Admin, HttpMethod.Delete, world.MemberPath(memberId));
        using var refused = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, accept);

        Assert.Equal(world.GroupId, joined["groupId"]!.GetValue<Guid>());
        Assert.Equal(("player", "dropIn"), (listed["role"]!.GetValue<string>(), listed["memberType"]!.GetValue<string>()));
        Assert.Equal(memberId, again["memberId"]!.GetValue<Guid>());
        Assert.Equal(1, useAfterAgain);
        Assert.Equal(HttpStatusCode.NoContent, left.StatusCode);
        Assert.Equal(memberId, back["memberId"]!.GetValue<Guid>());
        Assert.Equal(2, await UseCountAsync(world));
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        Assert.Equal("groups.member-removed", await CodeAsync(refused));
    }

    /// <summary>M14, the part that a stored role could break: an admin who left comes back as a player.</summary>
    [Fact]
    public async Task LeftAdmin_ComesBackAsPlayer()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var back = await world.SendAsync(A.LeftMember, HttpMethod.Post, GroupWorld.AcceptPath, GroupWorld.TokenBody(world.Invite.Token));

        Assert.Equal(HttpStatusCode.Created, back.StatusCode);
        Assert.Equal(new MemberState("player", "drop_in", "active", false), await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.LeftMember]));
    }

    [Fact]
    public async Task Preview_ShowsTheGroup_AndWhetherTheCallerIsIn()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, "Racha da prévia");
        var body = GroupWorld.TokenBody(world.Invite.Token);

        var outsider = await JsonAsync(world, A.NonMember, HttpMethod.Post, GroupWorld.PreviewPath, body, HttpStatusCode.OK);
        var member = await JsonAsync(world, A.Player, HttpMethod.Post, GroupWorld.PreviewPath, body, HttpStatusCode.OK);

        Assert.Equal(["activeMembers", "alreadyMember", "groupName"], [.. outsider.Select(field => field.Key).Order(StringComparer.Ordinal)]);
        Assert.Equal(("Racha da prévia", 4, false), (outsider["groupName"]!.GetValue<string>(), outsider["activeMembers"]!.GetValue<int>(), outsider["alreadyMember"]!.GetValue<bool>()));
        Assert.True(member["alreadyMember"]!.GetValue<bool>());
    }

    /// <summary>M10: another group's invite id, on this group's route, is not found, and that invite still works.</summary>
    [Fact]
    public async Task RevokeThroughAnotherGroup_IsNotFound_AndTheInviteStaysValid()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var others = await world.CreateInviteAsync(A.OutsiderMember, world.OtherGroupId);

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.InvitesPath}/{others.Id}");
        using var preview = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.PreviewPath, GroupWorld.TokenBody(others.Token));
        using var control = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.InvitesPath}/{world.Invite.Id}");

        Assert.Equal(HttpStatusCode.NotFound, refused.StatusCode);
        Assert.Equal("groups.invite-not-found", await CodeAsync(refused));
        Assert.Equal(HttpStatusCode.OK, preview.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, control.StatusCode);
    }

    /// <summary>Revoking twice is 204 both times, and the list no longer shows the link.</summary>
    [Fact]
    public async Task Revoke_IsIdempotent_AndTheListShowsOnlyValidLinks()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var second = await world.CreateInviteAsync(A.CoAdmin, world.GroupId);

        using var first = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.InvitesPath}/{world.Invite.Id}");
        using var again = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.InvitesPath}/{world.Invite.Id}");
        var listed = await ArrayAsync(world, A.Admin, world.InvitesPath);

        Assert.Equal((HttpStatusCode.NoContent, HttpStatusCode.NoContent), (first.StatusCode, again.StatusCode));
        var only = Assert.Single(listed)!.AsObject();
        Assert.Equal(second.Id, only["inviteId"]!.GetValue<Guid>());
        Assert.Equal(world.MemberIds[A.CoAdmin], only["createdBy"]!.GetValue<Guid>());
        Assert.Equal(["createdAt", "createdBy", "expiresAt", "inviteId", "useCount"], [.. only.Select(field => field.Key).Order(StringComparer.Ordinal)]);
    }

    /// <summary>M12: revoked, expired, missing and malformed tokens get the same body, byte for byte, on both routes.</summary>
    [Theory]
    [InlineData(GroupWorld.PreviewPath)]
    [InlineData(GroupWorld.AcceptPath)]
    public async Task DeadTokens_AllLookTheSame(string path)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var expired = await world.CreateInviteAsync(A.Admin, world.GroupId);
        await ExpireAsync(expired.Id);
        using var revoke = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.InvitesPath}/{world.Invite.Id}");
        var tokens = new[] { world.Invite.Token, expired.Token, NewToken(), "malformed", null };

        var bodies = new List<string>();
        foreach (var token in tokens)
        {
            using var response = await world.SendAsync(A.NonMember, HttpMethod.Post, path, GroupWorld.TokenBody(token));
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            bodies.Add(await WithoutTraceIdAsync(response));
        }

        Assert.Single(bodies.Distinct(StringComparer.Ordinal));
        Assert.Contains(InviteInvalid, bodies[0], StringComparison.Ordinal);
        Assert.Equal(0, await MembersOfAsync(world.GroupId, world.Users[A.NonMember]));
    }

    /// <summary>M13: a token in the query or the path is never read.</summary>
    [Fact]
    public async Task TokenOutsideTheBody_IsNeverRead()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var token = Uri.EscapeDataString(world.Invite.Token);

        using var query = await world.SendAsync(A.NonMember, HttpMethod.Post, $"{GroupWorld.AcceptPath}?token={token}", "{}");
        using var path = await world.SendAsync(A.NonMember, HttpMethod.Post, $"{GroupWorld.AcceptPath}/{token}", "{}");
        using var noBody = await world.SendAsync(A.NonMember, HttpMethod.Post, $"{GroupWorld.AcceptPath}?token={token}");

        Assert.Equal((HttpStatusCode.NotFound, InviteInvalid), (query.StatusCode, await CodeAsync(query)));
        Assert.Equal(HttpStatusCode.NotFound, path.StatusCode);
        Assert.Null(await CodeAsync(path));
        Assert.True(noBody.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.UnsupportedMediaType, $"{noBody.StatusCode}");
        Assert.Equal(0, await MembersOfAsync(world.GroupId, world.Users[A.NonMember]));
    }

    [Fact]
    public async Task UnknownField_IsABadRequest()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(
            A.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, $$"""{"token":"{{world.Invite.Token}}","groupId":"{{world.GroupId}}"}""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await MembersOfAsync(world.GroupId, world.Users[A.NonMember]));
    }

    /// <summary>
    /// M11, P6, L1 and L2: the token leaves the API once, in the 201 of its creation (with <c>no-store</c>); no
    /// other body, no column and no log line carries it or its hash, and a refused acceptance logs only its
    /// category and the invite id.
    /// </summary>
    [Fact]
    public async Task TokenAndHash_AppearOnlyInTheCreationResponse()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, "Racha do Beltrano");
        using var created = await world.SendAsync(A.Admin, HttpMethod.Post, world.InvitesPath);
        var createdText = await created.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var token = JsonNode.Parse(createdText)!["token"]!.GetValue<string>();
        var inviteId = JsonNode.Parse(createdText)!["inviteId"]!.GetValue<Guid>();
        var hash = SHA256.HashData(Encoding.ASCII.GetBytes(token));
        var secrets = new[] { token, Convert.ToHexString(hash), Convert.ToBase64String(hash), Convert.ToBase64String(hash).TrimEnd('=').Replace('+', '-').Replace('/', '_') };

        var bodies = new List<string>();
        foreach (var (actor, method, path, json) in new (A, HttpMethod, string, string?)[]
        {
            (A.Admin, HttpMethod.Get, world.InvitesPath, null),
            (A.Admin, HttpMethod.Get, world.GroupPath, null),
            (A.Admin, HttpMethod.Get, world.GroupPath + "/members", null),
            (A.NonMember, HttpMethod.Post, GroupWorld.PreviewPath, GroupWorld.TokenBody(token)),
            (A.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, GroupWorld.TokenBody(token)),
            (A.RemovedMember, HttpMethod.Post, GroupWorld.AcceptPath, GroupWorld.TokenBody(token)),
            (A.Admin, HttpMethod.Delete, $"{world.InvitesPath}/{inviteId}", null),
            (A.Player, HttpMethod.Post, GroupWorld.AcceptPath, GroupWorld.TokenBody(token)),
        })
        {
            using var response = await world.SendAsync(actor, method, path, json);
            bodies.Add($"{response.Headers}{response.Content.Headers}{await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)}");
        }

        Assert.Contains(token, createdText, StringComparison.Ordinal);
        Assert.Equal("no-store", created.Headers.CacheControl?.ToString());
        Assert.Null(created.Headers.Location);
        Assert.DoesNotContain(bodies, body => secrets.Any(secret => body.Contains(secret, StringComparison.OrdinalIgnoreCase)));
        Assert.Equal(hash, await StoredHashAsync(inviteId));
        Assert.DoesNotContain(token, await InviteRowTextAsync(world.GroupId), StringComparison.Ordinal);
        var logged = api.Logs.Entries;
        Assert.DoesNotContain(logged, entry => secrets.Append("Beltrano").Any(secret => entry.Contains(secret, StringComparison.OrdinalIgnoreCase)));
        Assert.Contains(logged, entry => entry.Contains($"Invite acceptance: groups.member-removed, invite {inviteId}.", StringComparison.Ordinal));
        Assert.Contains(logged, entry => entry.Contains($"Invite acceptance: {InviteInvalid}, invite {inviteId}.", StringComparison.Ordinal));
        Assert.Contains(logged, entry => entry.Contains($"Invite acceptance: joined, invite {inviteId}.", StringComparison.Ordinal));
    }

    [Fact]
    public async Task MalformedToken_LogsTheCategoryWithoutAnInvite()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var start = api.Logs.Count;

        using var refused = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, GroupWorld.TokenBody("canario-123"));

        Assert.Equal(HttpStatusCode.NotFound, refused.StatusCode);
        var logged = api.Logs.EntriesSince(start);
        Assert.Contains(logged, entry => entry.Contains($"Invite acceptance: {InviteInvalid}, invite none.", StringComparison.Ordinal));
        Assert.DoesNotContain(logged, entry => entry.Contains("canario-123", StringComparison.Ordinal));
    }

    /// <summary>D10 on the real API: the co-admin's link dies when they become a player; the admin's lives on.</summary>
    [Fact]
    public async Task DemotedCreator_LosesTheLink()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var coAdmins = await world.CreateInviteAsync(A.CoAdmin, world.GroupId);

        using var demoted = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(world.MemberIds[A.CoAdmin]) + "/role", """{"role":"player"}""");
        using var dead = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.PreviewPath, GroupWorld.TokenBody(coAdmins.Token));
        using var alive = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.PreviewPath, GroupWorld.TokenBody(world.Invite.Token));

        Assert.Equal(HttpStatusCode.OK, demoted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, dead.StatusCode);
        Assert.Equal(HttpStatusCode.OK, alive.StatusCode);
    }

    private static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static async Task<JsonObject> JsonAsync(GroupWorld world, A actor, HttpMethod method, string path, string? json, HttpStatusCode expected)
    {
        using var response = await world.SendAsync(actor, method, path, json);
        Assert.Equal(expected, response.StatusCode);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
    }

    private static async Task<JsonArray> ArrayAsync(GroupWorld world, A actor, string path)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsArray();
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return text.Length == 0 ? null : JsonNode.Parse(text)?.AsObject()["code"]?.GetValue<string>();
    }

    private static async Task<string> WithoutTraceIdAsync(HttpResponseMessage response)
    {
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
        Assert.True(body.Remove(TraceIdField));
        return $"{response.Content.Headers.ContentType}|{body.ToJsonString()}";
    }

    private async Task<int> UseCountAsync(GroupWorld world) =>
        (int)(await ScalarAsync("SELECT use_count FROM groups.invites WHERE id = @id", ("id", world.Invite.Id)))!;

    private async Task<long> MembersOfAsync(Guid groupId, Guid user) =>
        (long)(await ScalarAsync("SELECT count(*) FROM groups.members WHERE group_id = @id AND user_id = @user", ("id", groupId), ("user", user)))!;

    private async Task ExpireAsync(Guid inviteId) =>
        await ScalarAsync("UPDATE groups.invites SET expires_at = now() - interval '1 second' WHERE id = @id", ("id", inviteId));

    private async Task<byte[]> StoredHashAsync(Guid inviteId) =>
        (byte[])(await ScalarAsync("SELECT token_hash FROM groups.invites WHERE id = @id", ("id", inviteId)))!;

    /// <summary>P6: every invite row of the group as text, the way a dump would show it.</summary>
    private async Task<string> InviteRowTextAsync(Guid groupId) =>
        (string)(await ScalarAsync("SELECT string_agg(i::text, '|') FROM groups.invites i WHERE group_id = @id", ("id", groupId)))!;

    private async Task<object?> ScalarAsync(string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }

        return await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);
    }
}
