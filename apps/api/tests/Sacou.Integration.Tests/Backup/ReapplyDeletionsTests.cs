using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Npgsql;
using Sacou.Api.Operations;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Identity;
using Sacou.Integration.Tests.Notifications;
using Sacou.Tests.TestSupport;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Backup;

/// <summary>
/// S1 of E6.3 (ADR 0082, D10): a person deletes the account after the nightly dump, the dump is restored and brings the
/// person back, and <c>reapply-deletions</c> erases the person again, without touching anyone else. The current database
/// is read through a role with <c>pg_read_all_data</c> only, as the backup's role.
/// </summary>
public sealed class ReapplyDeletionsTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string GroupName = "Racha Restaurado do Sigilo";
    private const string SoloGroupName = "Racha Solitário do Sigilo";
    private const string Nickname = "Ressuscitado";
    private const string MePath = "/v1/me";
    private const int Succeeded = 0;
    private const int PasswordBytes = 18;

    /// <summary>Every table the reapply may write in the restored database, or must never write in the current one.</summary>
    private static readonly string[] Tables =
        ["identity.users", "identity.player_profiles", "identity.deleted_accounts", "groups.members", "groups.invites", "groups.member_levels", "notifications.push_devices"];

    private readonly string readerRole = "deletions_reader_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
    private readonly string readerPassword = Convert.ToHexString(RandomNumberGenerator.GetBytes(PasswordBytes));

    private BackupTools tools = null!;
    private ApiWithDatabase current = null!;
    private ApiWithDatabase? restored;

    public async ValueTask InitializeAsync()
    {
        tools = await BackupTools.StartAsync(database);
        current = new ApiWithDatabase(database, new Dictionary<string, string?> { ["ConnectionStrings:Sacou"] = tools.SourceConnectionString });
        await current.MigrateAsync();
        await BackupTools.ExecuteAsync(database.ConnectionString, $"CREATE ROLE {readerRole} LOGIN PASSWORD '{readerPassword}' IN ROLE pg_read_all_data");
    }

    public async ValueTask DisposeAsync()
    {
        if (restored is not null)
        {
            await restored.DisposeAsync();
        }

        await current.DisposeAsync();
        await tools.DisposeAsync();
        await BackupTools.ExecuteAsync(database.ConnectionString, $"DROP ROLE IF EXISTS {readerRole}");
    }

    /// <summary>Criteria 1 to 9 of S1, and question 231: the group the person ran gets its oldest member as Admin.</summary>
    [Fact]
    public async Task RestoredAccountDeletedAfterTheDump_IsErasedAgain_OnlyIt_AndOnlyOnce()
    {
        using var client = current.CreateClient();
        var world = await GroupWorld.CreateAsync(current, client, GroupName);
        var person = world.MemberIds[A.Admin];
        var soloGroup = await world.CreateGroupAsync(A.Admin, SoloGroupName);
        await PutProfileAsync(world, A.Admin);
        await PutProfileAsync(world, A.Player);
        using (var level = await LevelCalls.SetAsync(world, A.CoAdmin, person, "4"))
        {
            Assert.Equal(HttpStatusCode.OK, level.StatusCode);
        }

        await NotificationCalls.RegisterAsync(world, world.Subjects[A.Admin], Guid.NewGuid(), NotificationCalls.Token());
        await NotificationCalls.RegisterAsync(world, world.Subjects[A.Player], Guid.NewGuid(), NotificationCalls.Token());
        var dumpCreatedAt = DateTimeOffset.UtcNow;
        await DumpAndRestoreAsync();

        // In the current database the person hands the group over and goes, after the dump.
        await MemberRows.SetRoleAsync(tools.SourceConnectionString, world.MemberIds[A.CoAdmin], "admin");
        using (var deleted = await world.DeleteAccountAsync(A.Admin))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        }

        // The restored database brought the person back, still the only admin.
        Assert.Equal(1, await CountAsync(tools.TargetConnectionString, "SELECT count(*) FROM identity.users WHERE id = @id", world.Users[A.Admin]));
        Assert.Equal(0, await CountAsync(tools.TargetConnectionString, "SELECT count(*) FROM identity.deleted_accounts"));
        var heir = await OldestOtherActiveMemberAsync(world.GroupId, person);
        var playerBefore = await PersonRowsAsync(tools.TargetConnectionString, world.Users[A.Player]);
        var currentBefore = await SnapshotAsync(tools.SourceConnectionString);
        restored = RestoredApi();

        var (code, output) = await RunAsync(dumpCreatedAt);

        Assert.Equal(Succeeded, code);
        Assert.StartsWith("reapply-deletions: ok, 1 marks, 1 new marks, 1 accounts erased, 1 groups left without admin, ", output, StringComparison.Ordinal);
        var target = tools.TargetConnectionString;
        Assert.Equal(0, await CountAsync(target, "SELECT count(*) FROM identity.users WHERE id = @id", world.Users[A.Admin]));
        Assert.Equal(0, await CountAsync(target, "SELECT count(*) FROM identity.player_profiles WHERE user_id = @id", world.Users[A.Admin]));
        Assert.Equal(0, await CountAsync(target, "SELECT count(*) FROM groups.members WHERE user_id = @id", world.Users[A.Admin]));
        Assert.Equal(new MemberState("admin", "drop_in", "left", HasLeftAt: true), await MemberRows.ReadAsync(target, person));
        Assert.Equal(0, await CountAsync(target, "SELECT count(*) FROM groups.member_levels WHERE member_id = @id", person));
        Assert.Equal(1, await CountAsync(target, "SELECT count(*) FROM groups.invites WHERE id = @id AND revoked_at IS NOT NULL", world.Invite.Id));
        Assert.Equal(0, await CountAsync(target, "SELECT count(*) FROM notifications.push_devices WHERE user_id = @id", world.Users[A.Admin]));
        Assert.Equal(await MarkAsync(tools.SourceConnectionString), await MarkAsync(target));
        // Question 231: the oldest active member with an account runs the group; the group with no one left has no admin.
        Assert.Equal(1, await MemberRows.CountActiveAdminsAsync(target, world.GroupId));
        Assert.Equal("admin", (await MemberRows.ReadAsync(target, heir)).Role);
        Assert.Equal(0, await MemberRows.CountActiveAdminsAsync(target, soloGroup));
        Assert.Equal(playerBefore, await PersonRowsAsync(target, world.Users[A.Player]));
        Assert.Equal(currentBefore, await SnapshotAsync(tools.SourceConnectionString));

        var restoredBefore = await SnapshotAsync(target);
        var (again, secondOutput) = await RunAsync(dumpCreatedAt);

        Assert.Equal(Succeeded, again);
        Assert.StartsWith("reapply-deletions: ok, 1 marks, 0 new marks, 0 accounts erased, 0 groups left without admin, ", secondOutput, StringComparison.Ordinal);
        Assert.Equal(restoredBefore, await SnapshotAsync(target));

        await AssertTheApiRefusesThePersonAsync(world.Subjects[A.Admin]);
        var forbidden = new[]
        {
            world.Subjects[A.Admin], Nickname, GroupName, SoloGroupName, world.Users[A.Admin].ToString(), person.ToString(),
            world.GroupId.ToString(), Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(world.Subjects[A.Admin]))), tools.Password, readerPassword,
        };
        var everything = string.Join('\n', restored.Logs.Entries.Append(output).Append(secondOutput));
        Assert.All(forbidden, text => Assert.DoesNotContain(text, everything, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Criterion 7 (door 3): the database's hash of a login is <c>SubjectHash.Of</c>, ASCII or not.</summary>
    [Theory]
    [InlineData("aZ3kP9qL2mN8xR4tV6yB1cD5fG7h")]
    [InlineData("uid-ção-vôlei-🏐")]
    public async Task DatabaseHashOfALogin_IsTheSha256OfItsUtf8(string uid)
    {
        await using var connection = new NpgsqlConnection(tools.TargetConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var hash = new NpgsqlCommand("SELECT sha256(convert_to(@uid, 'UTF8'))", connection);
        hash.Parameters.AddWithValue("uid", uid);

        var computed = (byte[])(await hash.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;

        Assert.Equal(SHA256.HashData(Encoding.UTF8.GetBytes(uid)), computed);
    }

    private ApiWithDatabase RestoredApi() => new(database, new Dictionary<string, string?>(StringComparer.Ordinal)
    {
        // The test server has no TLS; an insecure sslmode is accepted only in Development (ADR 0068, D5).
        ["environment"] = "Development",
        ["ConnectionStrings:Sacou"] = tools.TargetConnectionString,
        [ReapplyDeletionsCommand.SourceVariable] = ReaderUrl(),
    });

    private async Task<(int Code, string Output)> RunAsync(DateTimeOffset dumpCreatedAt)
    {
        var command = OperationCommands.TryMatch(
            ["reapply-deletions", "--dump-created-at", dumpCreatedAt.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture)]);
        await using var output = new StringWriter(CultureInfo.InvariantCulture);
        var code = await command!.RunAsync(restored!.Services, output, TestContext.Current.CancellationToken);
        return (code, output.ToString());
    }

    private async Task DumpAndRestoreAsync()
    {
        var dumped = await tools.DumpAsync(tools.SourceUrl);
        Assert.True(dumped.ExitCode == Succeeded, dumped.Stderr);
        var files = await tools.BackupFilesAsync();
        var dump = Assert.Single(files, file => file.EndsWith(".dump", StringComparison.Ordinal));
        var manifest = Assert.Single(files, file => file.EndsWith(".manifest.json", StringComparison.Ordinal));
        var restoredDump = await tools.RestoreCheckAsync($"{BackupTools.BackupDirectory}/{dump}", $"{BackupTools.BackupDirectory}/{manifest}");
        Assert.True(restoredDump.ExitCode == Succeeded, restoredDump.Stderr);
    }

    /// <summary>The current database through a login that can only read (criterion 8), as the backup's role.</summary>
    private string ReaderUrl()
    {
        var server = new NpgsqlConnectionStringBuilder(tools.SourceConnectionString);
        return $"postgresql://{readerRole}:{readerPassword}@{server.Host}:{server.Port}/{server.Database}?sslmode=disable";
    }

    /// <summary>Criterion 3: the restored API answers the person as deleted, and creates nothing.</summary>
    private async Task AssertTheApiRefusesThePersonAsync(string subject)
    {
        using var client = restored!.CreateClient();
        var token = TestIdToken.Valid(restored.Key, DateTimeOffset.FromUnixTimeSeconds(restored.Clock.GetUtcNow().ToUnixTimeSeconds()))
            .With("sub", subject).With("user_id", subject).Sign();
        using var signIn = new HttpRequestMessage(HttpMethod.Post, MePath);
        signIn.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var gone = await client.SendAsync(signIn, TestContext.Current.CancellationToken);
        using var profile = new HttpRequestMessage(HttpMethod.Get, ProfileRows.ProfilePath);
        profile.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var unregistered = await client.SendAsync(profile, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Gone, gone.StatusCode);
        Assert.Equal("identity.account-deleted", await CodeAsync(gone));
        Assert.Equal(HttpStatusCode.Forbidden, unregistered.StatusCode);
        Assert.Equal("identity.user-not-registered", await CodeAsync(unregistered));
        Assert.Equal(0, await CountAsync(tools.TargetConnectionString, "SELECT count(*) FROM identity.users WHERE firebase_uid = @id", subject));
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonObject>(TestContext.Current.CancellationToken))?["code"]?.GetValue<string>();

    private static async Task PutProfileAsync(GroupWorld world, A actor)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: actor == A.Admin ? Nickname : "Fica"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>Who question 231 promotes, read before the command: earliest joined, then lowest id, active, with an account.</summary>
    private async Task<Guid> OldestOtherActiveMemberAsync(Guid group, Guid person)
    {
        await using var connection = await MemberRows.OpenAsync(tools.TargetConnectionString);
        await using var select = new NpgsqlCommand(
            "SELECT id FROM groups.members WHERE group_id = @group AND id <> @person AND status = 'active' AND user_id IS NOT NULL ORDER BY joined_at, id LIMIT 1",
            connection);
        select.Parameters.AddWithValue("group", group);
        select.Parameters.AddWithValue("person", person);
        return (Guid)(await select.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    /// <summary>The only mark, hash and date, as text: the copy keeps the date of the original deletion.</summary>
    private static Task<string> MarkAsync(string connectionString) =>
        ScalarAsync<string>(connectionString, "SELECT string_agg(t::text, ',') FROM identity.deleted_accounts t");

    /// <summary>Every row of the person (account, profile, members, devices) as text, to prove nothing of it changed.</summary>
    private static Task<string> PersonRowsAsync(string connectionString, Guid user) => ScalarAsync<string>(
        connectionString,
        """
        SELECT concat_ws('|',
            (SELECT string_agg(t::text, ',' ORDER BY t::text) FROM identity.users t WHERE id = @user),
            (SELECT string_agg(t::text, ',' ORDER BY t::text) FROM identity.player_profiles t WHERE user_id = @user),
            (SELECT string_agg(t::text, ',' ORDER BY t::text) FROM groups.members t WHERE user_id = @user),
            (SELECT string_agg(t::text, ',' ORDER BY t::text) FROM notifications.push_devices t WHERE user_id = @user))
        """,
        ("user", user));

    /// <summary>A digest of every row of <see cref="Tables"/>.</summary>
    private static Task<string> SnapshotAsync(string connectionString) => ScalarAsync<string>(
        connectionString,
        "SELECT concat_ws('|', " + string.Join(", ", Tables.Select(table => $"(SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) FROM {table} t)")) + ")");

    private static async Task<long> CountAsync(string connectionString, string sql, object? value = null) =>
        await ScalarAsync<long>(connectionString, sql, value is null ? [] : [("id", value)]);

    private static async Task<T> ScalarAsync<T>(string connectionString, string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }

        return (T)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }
}
