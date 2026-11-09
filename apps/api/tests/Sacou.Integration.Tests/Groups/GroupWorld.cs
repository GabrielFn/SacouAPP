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
/// creates the group through the API; the other members are written straight to the table, because the
/// routes that add them arrive in parts 2 and 3 of E3.2. Each actor is a new user.
/// </summary>
internal sealed class GroupWorld
{
    public const string GroupsPath = "/v1/groups";

    private const string SignInPath = "/v1/me";

    private readonly ApiWithDatabase api;
    private readonly HttpClient client;
    private readonly Dictionary<GroupActor, string> subjects = [];
    private readonly Dictionary<GroupActor, Guid> users = [];

    private GroupWorld(ApiWithDatabase api, HttpClient client)
    {
        this.api = api;
        this.client = client;
    }

    public Guid GroupId { get; private set; }

    public string GroupPath => $"{GroupsPath}/{GroupId}";

    public IReadOnlyDictionary<GroupActor, Guid> Users => users;

    public IReadOnlyDictionary<GroupActor, string> Subjects => subjects;

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

        world.GroupId = await world.CreateGroupAsync(GroupActor.Admin, groupName);
        await world.InsertMemberAsync(GroupActor.CoAdmin, "co_admin", "active");
        await world.InsertMemberAsync(GroupActor.Scorekeeper, "scorekeeper", "active");
        await world.InsertMemberAsync(GroupActor.Player, "player", "active");
        await world.InsertMemberAsync(GroupActor.LeftMember, "admin", "left");
        await world.InsertMemberAsync(GroupActor.RemovedMember, "player", "removed");
        await world.CreateGroupAsync(GroupActor.OutsiderMember, "Outro racha");
        return world;
    }

    public async Task<Guid> CreateGroupAsync(GroupActor actor, string name)
    {
        using var response = await SendAsync(actor, HttpMethod.Post, GroupsPath, $$"""{"name":{{JsonValue.Create(name).ToJsonString()}}}""");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonObject>(TestContext.Current.CancellationToken);
        return body!["groupId"]!.GetValue<Guid>();
    }

    public async Task<HttpResponseMessage> SendAsync(GroupActor actor, HttpMethod method, string path, string? json = null)
    {
        using var request = new HttpRequestMessage(method, path);
        if (actor != GroupActor.Anonymous)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(subjects[actor]));
        }

        if (json is not null)
        {
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Writes one member row, as parts 2 and 3 will through their routes.</summary>
    public async Task InsertMemberAsync(GroupActor actor, string role, string status, Guid? groupId = null)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at, left_at)
            VALUES (@id, @group, @user, @role, 'drop_in', @status, @now, CASE WHEN @status = 'active' THEN NULL ELSE @now END)
            """,
            connection);
        insert.Parameters.AddWithValue("id", Guid.CreateVersion7());
        insert.Parameters.AddWithValue("group", groupId ?? GroupId);
        insert.Parameters.AddWithValue("user", users[actor]);
        insert.Parameters.AddWithValue("role", role);
        insert.Parameters.AddWithValue("status", status);
        // The host clock, as the API uses: the database clock could order members differently.
        insert.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private string TokenFor(string subject) =>
        TestIdToken.Valid(api.Key, FixedTimeProvider.WholeSecondNow()).With("sub", subject).With("user_id", subject).Sign();

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
