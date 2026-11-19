using System.Globalization;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Xunit;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>
/// Case 1 of the E3.12 plan against the real database: the first insert of a weekly series' round is told its link code
/// is taken, so the series row, already saved in that rolled-back transaction, has to go in again with the second attempt.
/// </summary>
public sealed class RoundLinkClashTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string LinkCodeIndex = "ux_rounds_link_code";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Series_WhoseFirstCodeIsTaken_GoesInWithTheNextOne()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var clash = $"clash_{Guid.NewGuid():N}";
        await RunAsync(ClashOnceSql(clash, world.GroupId));
        try
        {
            var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(repeat: true));

            Assert.NotNull(created["seriesId"]);
            Assert.NotEmpty(RoundLinkCalls.CodeOf(created));
            Assert.Equal(1, await ScalarAsync($"SELECT count(*) FROM sessions.series WHERE group_id = '{world.GroupId}'"));
            Assert.Equal(2, await ScalarAsync($"SELECT last_value FROM {clash}"));
        }
        finally
        {
            await RunAsync($"DROP TRIGGER {clash} ON sessions.rounds; DROP FUNCTION {clash}(); DROP SEQUENCE {clash};");
        }
    }

    /// <summary>
    /// The first insert of a round of that group fails as a clash on the link code index; the sequence survives the
    /// rollback, so the next insert goes through. Only that group: the database is shared by the whole run.
    /// </summary>
    private static string ClashOnceSql(string name, Guid group) =>
        $"""
        CREATE SEQUENCE {name};
        CREATE FUNCTION {name}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF nextval('{name}') = 1 THEN
                RAISE EXCEPTION 'link code taken' USING ERRCODE = 'unique_violation', CONSTRAINT = '{LinkCodeIndex}';
            END IF;
            RETURN NEW;
        END $$;
        CREATE TRIGGER {name} BEFORE INSERT ON sessions.rounds
            FOR EACH ROW WHEN (NEW.group_id = '{group}') EXECUTE FUNCTION {name}();
        """;

    private async Task RunAsync(string sql)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task<long> ScalarAsync(string sql)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt64(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), CultureInfo.InvariantCulture);
    }
}
