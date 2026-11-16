using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Npgsql;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>Who calls a group route in the authorization matrix (plan E3.2, "Atores").</summary>
public enum GroupActor
{
    Admin,
    CoAdmin,
    Scorekeeper,
    Player,
    LeftMember,
    RemovedMember,
    OutsiderMember,
    NonMember,
    Unregistered,
    Anonymous,
}

/// <summary>
/// A new group with one person per actor, built for one test so no row depends on another. The admin
/// creates the group and one invite through the API; the other members are written straight to the table,
/// so each actor has exactly the role and status it names. Each actor is a new user.
/// </summary>
internal sealed class GroupWorld
{
    public const string GroupsPath = "/v1/groups";
    public const string PreviewPath = "/v1/invites/preview";
    public const string AcceptPath = "/v1/invites/accept";

    private const string SignInPath = "/v1/me";

    private readonly ApiWithDatabase api;
    private readonly HttpClient client;
    private readonly Dictionary<GroupActor, string> subjects = [];
    private readonly Dictionary<GroupActor, Guid> users = [];
    private readonly Dictionary<GroupActor, Guid> members = [];
    private CreatedInvite? invite;

    private GroupWorld(ApiWithDatabase api, HttpClient client)
    {
        this.api = api;
        this.client = client;
    }

    public Guid GroupId { get; private set; }

    public string GroupPath => $"{GroupsPath}/{GroupId}";

    public IReadOnlyDictionary<GroupActor, Guid> Users => users;

    public IReadOnlyDictionary<GroupActor, string> Subjects => subjects;

    /// <summary>
    /// Each actor's member id: in this group for the members (active or not), and in the other group for
    /// <see cref="GroupActor.OutsiderMember"/>, its admin.
    /// </summary>
    public IReadOnlyDictionary<GroupActor, Guid> MemberIds => members;

    public Guid OtherGroupId { get; private set; }

    /// <summary>The admin's invite to this group, made through the API: the only time its token is seen.</summary>
    public CreatedInvite Invite => invite ?? throw new InvalidOperationException("The world makes its invite when it is created.");

    public string InvitesPath => $"{GroupPath}/invites";

    public string MemberPath(Guid memberId) => $"{GroupPath}/members/{memberId}";

    public static async Task<GroupWorld> CreateAsync(ApiWithDatabase api, HttpClient client, string groupName = "Racha da matriz")
    {
        var world = new GroupWorld(api, client);
        foreach (var actor in Enum.GetValues<GroupActor>().Where(actor => actor != GroupActor.Anonymous))
        {
            world.subjects[actor] = "uid-" + Guid.NewGuid().ToString("N");
            if (actor != GroupActor.Unregistered)
            {
                world.users[actor] = await world.RegisterAsync(world.subjects[actor]);
            }
        }

        (world.GroupId, world.members[GroupActor.Admin]) = await world.CreateGroupWithMemberAsync(GroupActor.Admin, groupName);
        await world.InsertMemberAsync(GroupActor.CoAdmin, "co_admin", "active");
        await world.InsertMemberAsync(GroupActor.Scorekeeper, "scorekeeper", "active");
        await world.InsertMemberAsync(GroupActor.Player, "player", "active");
        await world.InsertMemberAsync(GroupActor.LeftMember, "admin", "left");
        await world.InsertMemberAsync(GroupActor.RemovedMember, "player", "removed");
        (world.OtherGroupId, world.members[GroupActor.OutsiderMember]) = await world.CreateGroupWithMemberAsync(GroupActor.OutsiderMember, "Outro racha");
        world.invite = await world.CreateInviteAsync(GroupActor.Admin, world.GroupId);
        return world;
    }

    /// <summary>A new invite through the API, as <paramref name="actor"/>, to <paramref name="groupId"/>.</summary>
    public async Task<CreatedInvite> CreateInviteAsync(GroupActor actor, Guid groupId)
    {
        using var response = await SendAsync(actor, HttpMethod.Post, $"{GroupsPath}/{groupId}/invites");
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonObject>(TestContext.Current.CancellationToken);
        return new CreatedInvite(body!["inviteId"]!.GetValue<Guid>(), body["token"]!.GetValue<string>());
    }

    /// <summary>The body of a preview or an acceptance: the token, and only in the body.</summary>
    public static string TokenBody(string? token) => $$"""{"token":{{JsonValue.Create(token)?.ToJsonString() ?? "null"}}}""";

    /// <summary>A new registered person who is in no group, for a test that needs many of them.</summary>
    public async Task<(string Subject, Guid User)> RegisterPersonAsync()
    {
        var subject = "uid-" + Guid.NewGuid().ToString("N");
        return (subject, await RegisterAsync(subject));
    }

    /// <summary>Like <see cref="SendAsync"/>, for a person who is not one of the actors.</summary>
    public async Task<HttpResponseMessage> SendAsAsync(string subject, HttpMethod method, string path, string? json = null)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(subject));
        if (json is not null)
        {
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    public async Task<Guid> CreateGroupAsync(GroupActor actor, string name) => (await CreateGroupWithMemberAsync(actor, name)).GroupId;

    /// <summary>One more active member with a new account, for a test that needs a target with a given role.</summary>
    public async Task<Guid> AddMemberAsync(string role)
    {
        var user = await RegisterAsync("uid-" + Guid.NewGuid().ToString("N"));
        return await InsertRowAsync(GroupId, user, role, "active");
    }

    /// <summary>One more active member who can call the API (a subject and a member id), with the given role and member type.</summary>
    public async Task<(string Subject, Guid MemberId)> AddPersonAsync(string role = "player", string memberType = "drop_in")
    {
        var subject = "uid-" + Guid.NewGuid().ToString("N");
        var user = await RegisterAsync(subject);
        var member = await InsertRowAsync(GroupId, user, role, "active", memberType);
        return (subject, member);
    }

    public async Task<HttpResponseMessage> SendAsync(GroupActor actor, HttpMethod method, string path, string? json = null)
    {
        if (actor != GroupActor.Anonymous)
        {
            return await SendAsAsync(subjects[actor], method, path, json);
        }

        using var request = new HttpRequestMessage(method, path);
        if (json is not null)
        {
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Writes one member row straight to the table, with exactly the role and status a test needs.</summary>
    public async Task InsertMemberAsync(GroupActor actor, string role, string status, Guid? groupId = null)
    {
        var member = await InsertRowAsync(groupId ?? GroupId, users[actor], role, status);
        if (groupId is null)
        {
            members[actor] = member;
        }
    }

    private async Task<(Guid GroupId, Guid MemberId)> CreateGroupWithMemberAsync(GroupActor actor, string name)
    {
        using var response = await SendAsync(actor, HttpMethod.Post, GroupsPath, $$"""{"name":{{JsonValue.Create(name).ToJsonString()}}}""");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonObject>(TestContext.Current.CancellationToken);
        return (body!["groupId"]!.GetValue<Guid>(), body["memberId"]!.GetValue<Guid>());
    }

    private async Task<Guid> InsertRowAsync(Guid groupId, Guid user, string role, string status, string memberType = "drop_in")
    {
        var id = Guid.CreateVersion7();
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at, left_at)
            VALUES (@id, @group, @user, @role, @type, @status, @now, CASE WHEN @status = 'active' THEN NULL ELSE @now END)
            """,
            connection);
        insert.Parameters.AddWithValue("id", id);
        insert.Parameters.AddWithValue("group", groupId);
        insert.Parameters.AddWithValue("user", user);
        insert.Parameters.AddWithValue("role", role);
        insert.Parameters.AddWithValue("type", memberType);
        insert.Parameters.AddWithValue("status", status);
        // The host clock, as the API uses: the database clock could order members differently.
        insert.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        return id;
    }

    /// <summary>
    /// <c>DELETE /v1/me</c> as <paramref name="subject"/>, signed in <paramref name="signedInAgo"/> before the API's
    /// clock (the default token signed in ten minutes ago, too old to delete, ADR 0056, D4).
    /// </summary>
    public async Task<HttpResponseMessage> DeleteAccountAsync(string subject, TimeSpan signedInAgo = default)
    {
        var now = DateTimeOffset.FromUnixTimeSeconds(api.Clock.GetUtcNow().ToUnixTimeSeconds());
        using var request = new HttpRequestMessage(HttpMethod.Delete, SignInPath);
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer", TestIdToken.Valid(api.Key, now).With("sub", subject).With("user_id", subject).At(now - signedInAgo, "auth_time").Sign());
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Like <see cref="DeleteAccountAsync(string, TimeSpan)"/>, as one of the actors.</summary>
    public Task<HttpResponseMessage> DeleteAccountAsync(GroupActor actor, TimeSpan signedInAgo = default) =>
        DeleteAccountAsync(subjects[actor], signedInAgo);

    private string TokenFor(string subject) =>
        TestIdToken.Valid(api.Key, DateTimeOffset.FromUnixTimeSeconds(api.Clock.GetUtcNow().ToUnixTimeSeconds())).With("sub", subject).With("user_id", subject).Sign();

    private async Task<Guid> RegisterAsync(string subject)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, SignInPath);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(subject));
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonObject>(TestContext.Current.CancellationToken);
        return body!["userId"]!.GetValue<Guid>();
    }
}

/// <summary>An invite as its creator sees it, once: the id and the token.</summary>
internal sealed record CreatedInvite(Guid Id, string Token);
