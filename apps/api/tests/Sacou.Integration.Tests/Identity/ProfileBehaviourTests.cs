using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Identity;

/// <summary>P1 of E3.17 (HTTP of the profile): read, write, refusals, who may call, the race and the logs, on a real Postgres.</summary>
public sealed class ProfileBehaviourTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int ConcurrentSaves = 16;
    private const string CodeField = "code";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task NeverSaved_IsProfileNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Player, HttpMethod.Get, ProfileRows.ProfilePath);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("identity.profile-not-found", (await JsonAsync(response))[CodeField]!.GetValue<string>());
    }

    /// <summary>The answer of the write is the stored profile: NFC, trimmed, in the canonical order, read back the same.</summary>
    [Fact]
    public async Task Save_ThenRead_GivesTheNormalizedProfile()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var body = ProfileRows.Body(nickname: "  João ", primary: "\"opposite\"", others: "[\"libero\",\"setter\"]", level: "45e-1");

        using var saved = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, body);
        using var read = await world.SendAsync(A.Player, HttpMethod.Get, ProfileRows.ProfilePath);
        var savedJson = await JsonAsync(saved);
        var readJson = await JsonAsync(read);

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.Equal(savedJson.ToJsonString(), readJson.ToJsonString());
        Assert.Equal("""{"nickname":"João","primaryPosition":"opposite","otherPositions":["setter","libero"],"suggestedLevel":4.5}""", readJson.ToJsonString());
        Assert.Equal(new ProfileState("João", "opposite", "setter,libero", 45), await ProfileRows.ReadAsync(api.ConnectionString, world.Users[A.Player]));
    }

    [Fact]
    public async Task NoPositionsNorLevel_IsAProfileWithANicknameOnly()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var saved = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(primary: "null", others: "[]", level: "null"));

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal("""{"nickname":"Caio","primaryPosition":null,"otherPositions":[],"suggestedLevel":null}""", (await JsonAsync(saved)).ToJsonString());
    }

    /// <summary>Names and enum values ignore case (ADR 0039); a level may be written in any form of the same number.</summary>
    [Theory]
    [InlineData("\"Setter\"", "4", 40)]
    [InlineData("\"SETTER\"", "4.0", 40)]
    [InlineData("\"setter\"", "4.50", 45)]
    [InlineData("\"setter\"", "1", 10)]
    [InlineData("\"setter\"", "5", 50)]
    public async Task AcceptedForms_AreStoredOnTheScale(string primary, string level, short tenths)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var saved = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(primary: primary, level: level));

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(new ProfileState("Caio", "setter", "libero", tenths), await ProfileRows.ReadAsync(api.ConnectionString, world.Users[A.Player]));
    }

    /// <summary>Every refused body is a 400, never a 500, and leaves the stored profile as it was.</summary>
    [Theory]
    [InlineData("""{"primaryPosition":"setter","otherPositions":[],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","otherPositions":[],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[]}""")]
    [InlineData("""{"nickname":null,"primaryPosition":"setter","otherPositions":[],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"captain","otherPositions":[],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":0,"otherPositions":[],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter,libero","otherPositions":[],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[null],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":null,"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":"libero","suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":["setter"],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"any","otherPositions":["libero"],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":4.25}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":"4"}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":"4.5"}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":true}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":1e400}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":0.5}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":5.5}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":-0}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":4,"userId":"00000000-0000-0000-0000-000000000000"}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":4,"adminLevel":5}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":4,"memberId":"00000000-0000-0000-0000-000000000000"}""")]
    [InlineData("""{"nickname":"Caio","NICKNAME":"Bia","primaryPosition":"setter","otherPositions":[],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter""")]
    [InlineData("""[]""")]
    public async Task RefusedBody_IsABadRequestAndChangesNothing(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var first = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: "Original"));
        var before = await ProfileRows.ReadAsync(api.ConnectionString, world.Users[A.Player]);

        using var refused = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, json);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(before, await ProfileRows.ReadAsync(api.ConnectionString, world.Users[A.Player]));
    }

    /// <summary>The canary: a refused nickname never comes back in the answer, and the code says why.</summary>
    [Theory]
    [InlineData("canario-123\u0000", "identity.nickname-invalid")]
    [InlineData("canario-123-com-mais-de-vinte", "identity.nickname-invalid")]
    [InlineData("   ", "identity.nickname-invalid")]
    public async Task InvalidNickname_IsRefusedWithoutEcho(string nickname, string code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var refused = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: nickname));
        var text = await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(code, JsonNode.Parse(text)![CodeField]!.GetValue<string>());
        Assert.DoesNotContain("canario", text, StringComparison.Ordinal);
        Assert.Null(await ProfileRows.ReadAsync(api.ConnectionString, world.Users[A.Player]));
    }

    [Theory]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":["setter"],"suggestedLevel":4}""")]
    [InlineData("""{"nickname":"Caio","primaryPosition":"setter","otherPositions":[],"suggestedLevel":4.25}""")]
    public async Task PositionOrLevelRule_IsProfileInvalid(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var refused = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, json);

        Assert.Equal("identity.profile-invalid", (await JsonAsync(refused))[CodeField]!.GetValue<string>());
    }

    /// <summary>Not signed in: 401 with no code. Signed in without <c>POST /v1/me</c>: 403, before any body rule.</summary>
    [Theory]
    [InlineData(A.Anonymous, "GET", 401, null)]
    [InlineData(A.Anonymous, "PUT", 401, null)]
    [InlineData(A.Unregistered, "GET", 403, "identity.user-not-registered")]
    [InlineData(A.Unregistered, "PUT", 403, "identity.user-not-registered")]
    [InlineData(A.NonMember, "GET", 404, "identity.profile-not-found")]
    [InlineData(A.NonMember, "PUT", 200, null)]
    [InlineData(A.LeftMember, "PUT", 200, null)]
    [InlineData(A.Admin, "PUT", 200, null)]
    public async Task Matrix_WhoMayReadAndWriteTheirProfile(A actor, string method, int status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(actor, new HttpMethod(method), ProfileRows.ProfilePath, method == "PUT" ? ProfileRows.Body() : null);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal((HttpStatusCode)status, response.StatusCode);
        Assert.Equal(code, response.IsSuccessStatusCode || text.Length == 0 ? null : JsonNode.Parse(text)?[CodeField]?.GetValue<string>());
    }

    /// <summary>No id in the route nor the body: one person's write never touches another's profile.</summary>
    [Fact]
    public async Task Save_ChangesOnlyTheCallersProfile()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var other = await world.SendAsync(A.Admin, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: "Joao", level: "2"));

        using var mine = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: "Caio", level: "5"));

        Assert.Equal(new ProfileState("Joao", "setter", "libero", 20), await ProfileRows.ReadAsync(api.ConnectionString, world.Users[A.Admin]));
        Assert.Equal(new ProfileState("Caio", "setter", "libero", 50), await ProfileRows.ReadAsync(api.ConnectionString, world.Users[A.Player]));
    }

    /// <summary>D10: sixteen first saves at once give sixteen 200s, one row, and one of the values sent.</summary>
    [Fact]
    public async Task ConcurrentFirstSaves_LeaveOneRow()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var nicknames = Enumerable.Range(0, ConcurrentSaves).Select(index => $"Caio {index}").ToList();

        var responses = await Task.WhenAll(nicknames.Select(nickname =>
            world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: nickname))));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        Assert.Equal(1, await ProfileRows.CountAsync(api.ConnectionString, world.Users[A.Player]));
        Assert.Contains((await ProfileRows.ReadAsync(api.ConnectionString, world.Users[A.Player]))!.Nickname, nicknames);
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    /// <summary>L1 of E3.2, extended: no log entry carries a nickname, though the provider does collect the API logs.</summary>
    [Fact]
    public async Task Logs_NeverCarryTheNickname()
    {
        const string Secret = "Fulaninho";
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var start = api.Logs.Count;

        using var saved = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: Secret));
        using var refused = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: Secret + "\u0000"));
        using var read = await world.SendAsync(A.Player, HttpMethod.Get, ProfileRows.ProfilePath);
        using var listed = await world.SendAsync(A.Admin, HttpMethod.Get, world.GroupPath + "/members");

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Contains(Secret, await listed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
        Assert.NotEmpty(api.Logs.EntriesSince(start));
        Assert.DoesNotContain(api.Logs.Entries, entry => entry.Contains(Secret, StringComparison.OrdinalIgnoreCase));
    }

    private static async Task<JsonObject> JsonAsync(HttpResponseMessage response) =>
        JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
}
