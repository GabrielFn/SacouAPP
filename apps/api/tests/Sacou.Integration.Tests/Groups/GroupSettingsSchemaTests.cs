using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>P1 and P4 of E3.3: the settings tables on a real Postgres, and their CHECKs and keys doing their job.</summary>
public sealed class GroupSettingsSchemaTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string CheckViolation = "23514";
    private const string ForeignKeyViolation = "23503";
    private const string ValidDocument = """{"schemaVersion":1}""";
    private const string ValidDocumentSql = """'{"schemaVersion":1}'::jsonb""";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Migration_HistoryStaysInTheGroupsSchema_AndTheTemplateIndexExists()
    {
        await using var connection = await OpenAsync();

        Assert.Equal(
            ["20261109143655_CreateGroups", "20261110054747_AddGroupSettings", "20261112120000_AddQueueExitModeSettings"],
            await ReadAsync(connection, "SELECT \"MigrationId\" FROM groups.__ef_migrations_history ORDER BY \"MigrationId\""));
        Assert.Contains(
            "ix_saved_templates_group",
            await ReadAsync(connection, "SELECT indexname FROM pg_indexes WHERE schemaname = 'groups' AND tablename = 'saved_templates'"));
    }

    [Theory]
    [InlineData(ValidDocumentSql, 2, "NULL", "NULL")]
    [InlineData("'[]'::jsonb", 1, "NULL", "NULL")]
    [InlineData("'\"text\"'::jsonb", 1, "NULL", "NULL")]
    [InlineData("jsonb_build_object('schemaVersion', 1, 'padding', repeat('x', 9000))", 1, "NULL", "NULL")]
    [InlineData(ValidDocumentSql, 1, "'inexistente'", "NULL")]
    [InlineData(ValidDocumentSql, 1, "'treino'", "gen_random_uuid()")]
    public async Task InvalidSettingsRow_IsRefusedByTheDatabase(string document, int version, string templateKey, string savedTemplate)
    {
        var failure = await Assert.ThrowsAsync<PostgresException>(() => InsertSettingsAsync(document, version, templateKey, savedTemplate));

        Assert.Equal(CheckViolation, failure.SqlState);
    }

    [Theory]
    [InlineData(ValidDocumentSql, "'pelada'", "NULL")]
    [InlineData(ValidDocumentSql, "NULL", "gen_random_uuid()")]
    [InlineData(ValidDocumentSql, "NULL", "NULL")]
    public async Task ValidSettingsRow_IsAccepted(string document, string templateKey, string savedTemplate)
    {
        await InsertSettingsAsync(document, 1, templateKey, savedTemplate);
    }

    [Theory]
    [InlineData("''", ValidDocument, 1)]
    [InlineData("repeat('a', 161)", ValidDocument, 1)]
    [InlineData("'Modelo'", "[]", 1)]
    [InlineData("'Modelo'", ValidDocument, 2)]
    public async Task InvalidTemplateRow_IsRefusedByTheDatabase(string name, string document, int version)
    {
        var failure = await Assert.ThrowsAsync<PostgresException>(() => InsertTemplateAsync(name, document, version, ofThisGroup: true));

        Assert.Equal(CheckViolation, failure.SqlState);
    }

    [Fact]
    public async Task TemplateOfAMissingGroup_IsRefusedByTheForeignKey()
    {
        var failure = await Assert.ThrowsAsync<PostgresException>(() => InsertTemplateAsync("'Modelo'", ValidDocument, 1, ofThisGroup: false));

        Assert.Equal(ForeignKeyViolation, failure.SqlState);
    }

    private async Task InsertSettingsAsync(string document, int version, string templateKey, string savedTemplate)
    {
        var (group, member) = await InsertGroupWithMemberAsync();
        await using var connection = await OpenAsync();
        await using var insert = new NpgsqlCommand(
            $"""
            INSERT INTO groups.group_settings (group_id, schema_version, settings, template_key, saved_template_id, updated_at, updated_by_member_id)
            VALUES (@group, @version, {document}, {templateKey}, {savedTemplate}, now(), @member)
            """,
            connection);
        insert.Parameters.AddWithValue("group", group);
        insert.Parameters.AddWithValue("version", (short)version);
        insert.Parameters.AddWithValue("member", member);
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task InsertTemplateAsync(string name, string document, int version, bool ofThisGroup)
    {
        var (group, member) = await InsertGroupWithMemberAsync();
        await using var connection = await OpenAsync();
        await using var insert = new NpgsqlCommand(
            $"""
            INSERT INTO groups.saved_templates (id, group_id, name, schema_version, settings, created_at, created_by_member_id)
            VALUES (@id, @group, {name}, @version, @document::jsonb, now(), @member)
            """,
            connection);
        insert.Parameters.AddWithValue("id", Guid.CreateVersion7());
        insert.Parameters.AddWithValue("group", ofThisGroup ? group : Guid.NewGuid());
        insert.Parameters.AddWithValue("version", (short)version);
        insert.Parameters.AddWithValue("document", document);
        insert.Parameters.AddWithValue("member", member);
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task<(Guid Group, Guid Member)> InsertGroupWithMemberAsync()
    {
        var group = Guid.CreateVersion7();
        var member = Guid.CreateVersion7();
        await using var connection = await OpenAsync();
        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO groups.groups (id, name, created_at) VALUES (@group, 'Racha', now());
            INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at)
            VALUES (@member, @group, @user, 'admin', 'regular', 'active', now())
            """,
            connection);
        insert.Parameters.AddWithValue("group", group);
        insert.Parameters.AddWithValue("member", member);
        insert.Parameters.AddWithValue("user", Guid.NewGuid());
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        return (group, member);
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
