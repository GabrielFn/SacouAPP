using Npgsql;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Identity;

/// <summary>P1 of E3.17 (database): the migration on a real Postgres, and the constraints doing their job.</summary>
public sealed class ProfileSchemaTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string CheckViolation = "23514";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Migration_CreatesTheSixColumnsAndTheirConstraints()
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);

        Assert.Equal(
            [
                "nickname:text:NO", "other_positions:ARRAY:NO", "primary_position:text:YES", "suggested_level_tenths:smallint:YES",
                "updated_at:timestamp with time zone:NO", "user_id:uuid:NO",
            ],
            await ReadAsync(connection, """
                SELECT column_name || ':' || data_type || ':' || is_nullable FROM information_schema.columns
                WHERE table_schema = 'identity' AND table_name = 'player_profiles' ORDER BY column_name
                """));
        Assert.Equal(
            [
                "ck_player_profiles_nickname_length", "ck_player_profiles_other_positions", "ck_player_profiles_other_positions_count",
                "ck_player_profiles_primary_position", "ck_player_profiles_suggested_level",
            ],
            await ReadAsync(connection, "SELECT conname FROM pg_constraint WHERE contype = 'c' AND conrelid = 'identity.player_profiles'::regclass ORDER BY conname"));
        Assert.Equal(
            ["fk_player_profiles_users:c"],
            await ReadAsync(connection, "SELECT conname || ':' || confdeltype FROM pg_constraint WHERE contype = 'f' AND conrelid = 'identity.player_profiles'::regclass"));
    }

    /// <summary>The database refuses what the domain refuses, should a bug or a hand-written row get past it; 4.5 is the control.</summary>
    [Theory]
    [InlineData("'Caio'", "'captain'", "'{}'", "NULL")]
    [InlineData("'Caio'", "'setter'", "'{captain}'", "NULL")]
    [InlineData("'Caio'", "'any'", "'{setter,opposite,libero,middle_blocker,outside_hitter}'", "NULL")]
    [InlineData("'Caio'", "NULL", "'{}'", "45")]
    [InlineData("'Caio'", "NULL", "'{}'", "42")]
    [InlineData("'Caio'", "NULL", "'{}'", "5")]
    [InlineData("'Caio'", "NULL", "'{}'", "55")]
    [InlineData("''", "NULL", "'{}'", "NULL")]
    [InlineData("repeat('a', 81)", "NULL", "'{}'", "NULL")]
    public async Task Checks_RefuseValuesOffTheRule(string nickname, string primary, string others, string level)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        var valid = level == "45";
        await using var insert = new NpgsqlCommand(
            $"""
            INSERT INTO identity.player_profiles (user_id, nickname, primary_position, other_positions, suggested_level_tenths, updated_at)
            VALUES (@user, {nickname}, {primary}, {others}, {level}, now())
            """,
            connection);
        insert.Parameters.AddWithValue("user", world.Users[A.Player]);

        if (valid)
        {
            Assert.Equal(1, await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken));
            return;
        }

        var error = await Assert.ThrowsAsync<PostgresException>(() => insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken));
        Assert.Equal(CheckViolation, error.SqlState);
    }

    /// <summary>Deleting the user deletes the profile (the exclusion of E3.16 relies on it).</summary>
    [Fact]
    public async Task DeletingTheUser_DeletesTheProfile()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (subject, user) = await world.RegisterPersonAsync();
        using var saved = await world.SendAsAsync(subject, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body());
        Assert.Equal(1, await ProfileRows.CountAsync(api.ConnectionString, user));

        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var delete = new NpgsqlCommand("DELETE FROM identity.users WHERE id = @user", connection);
        delete.Parameters.AddWithValue("user", user);
        await delete.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);

        Assert.Equal(0, await ProfileRows.CountAsync(api.ConnectionString, user));
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
}
