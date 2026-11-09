using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>P1, P4 and P5 of E3.2: the migration on a real Postgres, and the constraints doing their job.</summary>
public sealed class GroupsSchemaTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string UniqueViolation = "23505";
    private const string CheckViolation = "23514";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Migration_CreatesTheThreeTablesWithTheirConstraints()
    {
        await using var connection = await OpenAsync();

        Assert.Equal(
            ["__ef_migrations_history", "groups", "invites", "members"],
            await ReadAsync(connection, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'groups' ORDER BY table_name"));
        Assert.Equal(
            ["ck_groups_name_length", "ck_invites_token_hash_length", "ck_invites_use_count", "ck_members_left_at", "ck_members_member_type", "ck_members_role", "ck_members_status"],
            await ReadAsync(connection, "SELECT conname FROM pg_constraint WHERE contype = 'c' AND connamespace = 'groups'::regnamespace ORDER BY conname"));
        Assert.Equal(
            ["ux_invites_token_hash", "ux_members_group_user"],
            await ReadAsync(connection, "SELECT indexname FROM pg_indexes WHERE schemaname = 'groups' AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexname LIKE 'ux_%' ORDER BY indexname"));
        Assert.Equal(
            ["fk_invites_groups", "fk_invites_members", "fk_members_groups"],
            await ReadAsync(connection, "SELECT conname FROM pg_constraint WHERE contype = 'f' AND connamespace = 'groups'::regnamespace ORDER BY conname"));
        Assert.Contains(
            "WHERE (user_id IS NOT NULL)",
            (await ReadAsync(connection, "SELECT indexdef FROM pg_indexes WHERE indexname = 'ux_members_group_user'")).Single(),
            StringComparison.Ordinal);
        Assert.Equal(["__ef_migrations_history"], await ReadAsync(connection, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'identity' AND table_name LIKE '\\_\\_%'"));
    }

    [Fact]
    public async Task NoForeignKey_PointsToAnotherModule()
    {
        await using var connection = await OpenAsync();

        Assert.Empty(await ReadAsync(connection, """
            SELECT conname FROM pg_constraint
            WHERE contype = 'f' AND connamespace = 'groups'::regnamespace
              AND confrelid::regclass::text NOT LIKE 'groups.%'
            """));
    }

    /// <summary>P4: one member id per person per group, while guests without an account may be many.</summary>
    [Fact]
    public async Task SamePersonTwiceInAGroup_IsRefused_ButGuestsAreNot()
    {
        var group = await InsertGroupAsync();
        var user = Guid.NewGuid();

        await InsertMemberAsync(group, user, "active");
        var duplicate = await Assert.ThrowsAsync<PostgresException>(() => InsertMemberAsync(group, user, "left"));
        await InsertMemberAsync(group, null, "active");
        await InsertMemberAsync(group, null, "active");

        Assert.Equal(UniqueViolation, duplicate.SqlState);
    }

    /// <summary>P5: active exactly when there is no leaving time; a role outside the list fails too.</summary>
    [Theory]
    [InlineData("active", true, "player")]
    [InlineData("left", false, "player")]
    [InlineData("removed", false, "player")]
    [InlineData("active", false, "owner")]
    [InlineData("paused", false, "player")]
    public async Task StatusLeftAtAndRole_AreChecked(string status, bool withLeftAt, string role)
    {
        var group = await InsertGroupAsync();

        var failure = await Assert.ThrowsAsync<PostgresException>(() => InsertMemberAsync(group, Guid.NewGuid(), status, withLeftAt, role));

        Assert.Equal(CheckViolation, failure.SqlState);
    }

    [Fact]
    public async Task NameOverTheCodePointLimit_IsRefusedByTheDatabase()
    {
        var failure = await Assert.ThrowsAsync<PostgresException>(() => InsertGroupAsync(new string('a', 241)));

        Assert.Equal(CheckViolation, failure.SqlState);
    }

    private async Task<Guid> InsertGroupAsync(string name = "Racha")
    {
        var id = Guid.CreateVersion7();
        await using var connection = await OpenAsync();
        await using var insert = new NpgsqlCommand("INSERT INTO groups.groups (id, name, created_at) VALUES (@id, @name, now())", connection);
        insert.Parameters.AddWithValue("id", id);
        insert.Parameters.AddWithValue("name", name);
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        return id;
    }

    private async Task InsertMemberAsync(Guid group, Guid? user, string status, bool? withLeftAt = null, string role = "player")
    {
        await using var connection = await OpenAsync();
        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at, left_at)
            VALUES (@id, @group, @user, @role, 'drop_in', @status, now(), CASE WHEN @withLeftAt THEN now() ELSE NULL END)
            """,
            connection);
        insert.Parameters.AddWithValue("id", Guid.CreateVersion7());
        insert.Parameters.AddWithValue("group", group);
        insert.Parameters.AddWithValue("user", user is { } value ? value : DBNull.Value);
        insert.Parameters.AddWithValue("role", role);
        insert.Parameters.AddWithValue("status", status);
        insert.Parameters.AddWithValue("withLeftAt", withLeftAt ?? status != "active");
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<List<string>> ReadAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        var values = new List<string>();
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            values.Add(reader.GetString(0));
        }

        return values;
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }
}
