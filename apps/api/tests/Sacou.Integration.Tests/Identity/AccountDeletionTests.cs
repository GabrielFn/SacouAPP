using System.Net;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Identity;

/// <summary>
/// D1 to D10, C1 to C3 and L1 of E3.16 part 2 (ADR 0056): <c>DELETE /v1/me</c> on a real Postgres. The person goes,
/// the history stays as a former player: the same member id, no user id, the attendances kept.
/// </summary>
public sealed class AccountDeletionTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string MePath = "/v1/me";
    private const string ExportPath = "/v1/me/export";
    private const string PersonNickname = "Sumidinho";
    private const string GroupName = "Racha da exclusão";
    private const int Repetitions = 5;

    private static readonly TimeSpan OldLogin = TimeSpan.FromMinutes(10);

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>D1, the acceptance (golden of the history): items (a) to (e) of the plan, seen by the admin before and after.</summary>
    [Fact]
    public async Task Deletion_KeepsTheHistoryAsAFormerPlayer()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, GroupName);
        var person = world.MemberIds[A.Player];
        await PutProfileAsync(world, A.Player);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true)).Status);
        using (var note = await LevelCalls.SetAsync(world, A.Admin, person, "3.5"))
        {
            Assert.Equal(HttpStatusCode.OK, note.StatusCode);
        }

        Assert.Equal(PersonNickname, (await GuestCalls.MembersAsync(world))[person]["nickname"]?.GetValue<string>());

        using var deleted = await world.DeleteAccountAsync(A.Player);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal("no-store", deleted.Headers.CacheControl?.ToString());
        // (a) the same member id, no user id, left now.
        Assert.Equal(new MemberState("player", "drop_in", "left", HasLeftAt: true), await MemberRows.ReadAsync(api.ConnectionString, person));
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM groups.members WHERE id = @id AND user_id IS NOT NULL", person));
        // (b) the attendance stays, by member id.
        Assert.Contains(await RoundCalls.RowsAsync(api.ConnectionString, round), row => row.MemberId == person);
        // (c) neither the account nor the profile is left.
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM identity.users WHERE id = @id", world.Users[A.Player]));
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM identity.player_profiles WHERE user_id = @id", world.Users[A.Player]));
        // (d) the notes about the person are gone.
        Assert.Null(await LevelCalls.ReadAsync(api.ConnectionString, person));
        // (e) nothing the admin reads names the person.
        Assert.DoesNotContain(person, (await GuestCalls.MembersAsync(world)).Keys);
        var detail = await RoundCalls.GetAsync(world, round);
        Assert.DoesNotContain(PersonNickname, detail.ToJsonString(), StringComparison.Ordinal);
        Assert.DoesNotContain(person.ToString(), detail.ToJsonString(), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>D2: a sign-in ten minutes old is a 403 that changes nothing; a fresh one deletes.</summary>
    [Fact]
    public async Task OldLogin_IsRefused_UntilTheyComeBackFresh()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await PutProfileAsync(world, A.Player);

        using var old = await world.DeleteAccountAsync(A.Player, OldLogin);

        Assert.Equal(HttpStatusCode.Forbidden, old.StatusCode);
        Assert.Equal("identity.recent-login-required", await RoundCalls.CodeAsync(old));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM identity.player_profiles WHERE user_id = @id", world.Users[A.Player]));
        Assert.Equal("active", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).Status);
        Assert.Equal(0, await TombstonesAsync(world.Subjects[A.Player]));

        using var fresh = await world.DeleteAccountAsync(A.Player);
        Assert.Equal(HttpStatusCode.NoContent, fresh.StatusCode);
    }

    /// <summary>D3: the only admin with a player who could take over gets 409 with the group, nothing written; after handing over, 204.</summary>
    [Fact]
    public async Task OnlyAdmin_IsBlocked_UntilSomeoneTakesOver()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await PutProfileAsync(world, A.Admin);
        using (var note = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.Player], "4"))
        {
            Assert.Equal(HttpStatusCode.OK, note.StatusCode);
        }

        using var blocked = await world.DeleteAccountAsync(A.Admin);

        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        var body = await RoundCalls.JsonAsync(blocked);
        Assert.Equal("identity.deletion-blocked", body["code"]!.GetValue<string>());
        Assert.Equal([world.GroupId], body["groupIds"]!.AsArray().Select(id => id!.GetValue<Guid>()));
        Assert.Equal("active", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Admin])).Status);
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM identity.player_profiles WHERE user_id = @id", world.Users[A.Admin]));
        Assert.NotNull(await LevelCalls.ReadAsync(api.ConnectionString, world.MemberIds[A.Player]));
        Assert.Equal(0, await TombstonesAsync(world.Subjects[A.Admin]));

        await MemberRows.SetRoleAsync(api.ConnectionString, world.MemberIds[A.Player], "admin");
        using var deleted = await world.DeleteAccountAsync(A.Admin);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(new MemberState("admin", "drop_in", "left", HasLeftAt: true), await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Admin]));
    }

    /// <summary>D4 and D5: deleting twice is 204 twice with one tombstone; the same token then gets 410 on sign-in and 403 elsewhere.</summary>
    [Fact]
    public async Task Repeating_IsASuccess_AndTheAccountNeverComesBack()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var subject = world.Subjects[A.Player];

        using var first = await world.DeleteAccountAsync(A.Player);
        using var second = await world.DeleteAccountAsync(A.Player);
        using var signIn = await world.SendAsync(A.Player, HttpMethod.Post, MePath);
        using var export = await world.SendAsync(A.Player, HttpMethod.Get, ExportPath);

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
        Assert.Equal(1, await TombstonesAsync(subject));
        Assert.Equal(HttpStatusCode.Gone, signIn.StatusCode);
        Assert.Equal("identity.account-deleted", await RoundCalls.CodeAsync(signIn));
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM identity.users WHERE firebase_uid = @id", subject));
        Assert.Equal(HttpStatusCode.Forbidden, export.StatusCode);
        Assert.Equal("identity.user-not-registered", await RoundCalls.CodeAsync(export));
    }

    /// <summary>D7: the person was going to a full future round; the first of the waitlist takes the spot.</summary>
    [Fact]
    public async Task FutureRound_GivesTheSpotToTheWaitlist()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 1);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true)).Status);
        var waiting = await RoundCalls.RespondAsync(world, world.Subjects[A.CoAdmin], round, going: true);
        Assert.Equal("waitlisted", waiting.Body!["status"]!.GetValue<string>());

        using var deleted = await world.DeleteAccountAsync(A.Player);
        _ = await RoundCalls.GetAsync(world, round);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        var rows = (await RoundCalls.RowsAsync(api.ConnectionString, round)).ToDictionary(row => row.MemberId, row => row.Status);
        Assert.Equal("not_going", rows[world.MemberIds[A.Player]]);
        Assert.Equal("promoted", rows[world.MemberIds[A.CoAdmin]]);
    }

    /// <summary>D8: the notes about the person go; the one they gave stays, with the same author member id.</summary>
    [Fact]
    public async Task Notes_AboutThePersonGo_TheOnesTheyGaveStay()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using (var given = await LevelCalls.SetAsync(world, A.CoAdmin, world.MemberIds[A.Player], "2.5"))
        using (var received = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.CoAdmin], "4"))
        {
            Assert.Equal(HttpStatusCode.OK, given.StatusCode);
            Assert.Equal(HttpStatusCode.OK, received.StatusCode);
        }

        using var deleted = await world.DeleteAccountAsync(A.CoAdmin);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Null(await LevelCalls.ReadAsync(api.ConnectionString, world.MemberIds[A.CoAdmin]));
        Assert.Equal(new LevelState(25, world.MemberIds[A.CoAdmin]), await LevelCalls.ReadAsync(api.ConnectionString, world.MemberIds[A.Player]));
    }

    /// <summary>D9 (question 64): the last member with an account goes, so the guests' names go; their member ids stay.</summary>
    [Fact]
    public async Task LastMemberWithAnAccount_TakesTheGuestNamesAlong()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var group = await world.CreateGroupAsync(A.NonMember, "Só eu e os convidados");
        foreach (var name in new[] { "Léo", "Bia" })
        {
            using var added = await world.SendAsync(A.NonMember, HttpMethod.Post, $"{GroupWorld.GroupsPath}/{group}/guests", GuestCalls.AddBody(Guid.NewGuid(), name));
            Assert.Equal(HttpStatusCode.Created, added.StatusCode);
        }

        using var deleted = await world.DeleteAccountAsync(A.NonMember);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(0, await GuestCalls.CountAsync(api.ConnectionString, group));
        Assert.Equal(3, await CountAsync("SELECT count(*) FROM groups.members WHERE group_id = @id", group));
        Assert.Empty(await GuestCalls.FindTextAsync(api.ConnectionString, "Léo"));
    }

    /// <summary>R3: a former player is no guest, so the guest correction route does not find them.</summary>
    [Fact]
    public async Task FormerPlayer_IsNoGuest()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var deleted = await world.DeleteAccountAsync(A.Player);

        using var corrected = await world.SendAsync(
            A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, world.MemberIds[A.Player]), GuestCalls.CorrectBody("Fantasma", null));

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, corrected.StatusCode);
    }

    /// <summary>D10: a body on the delete is a 400 that keeps the account.</summary>
    [Fact]
    public async Task Body_IsRefused()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Player, HttpMethod.Delete, MePath, """{"confirm":"EXCLUIR"}""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("active", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).Status);
    }

    /// <summary>
    /// C1: the only admin deletes while promoting the player. Promotion first: 204 and the player is the admin.
    /// Deletion first: 409. Never a group whose player with an account is left without an admin.
    /// </summary>
    [Fact]
    public async Task DeletionWhilePromoting_NeverLeavesTheGroupWithoutAnAdmin()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);
            var player = world.MemberIds[A.Player];
            var statuses = await RaceAsync(
                async () => (await world.DeleteAccountAsync(A.Admin)).StatusCode,
                async () => (await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(player) + "/role", """{"role":"admin"}""")).StatusCode);

            Assert.Contains(statuses[0], new[] { HttpStatusCode.NoContent, HttpStatusCode.Conflict });
            Assert.Equal(1, await MemberRows.CountActiveAdminsAsync(api.ConnectionString, world.GroupId));
            if (statuses[0] == HttpStatusCode.NoContent)
            {
                Assert.Equal("admin", (await MemberRows.ReadAsync(api.ConnectionString, player)).Role);
            }
        }
    }

    /// <summary>C2: two deletions together are two 204, one tombstone, one former player, no deadlock.</summary>
    [Fact]
    public async Task TwoDeletionsTogether_EndInOneState()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);

            var statuses = await RaceAsync(
                async () => (await world.DeleteAccountAsync(A.Player)).StatusCode,
                async () => (await world.DeleteAccountAsync(A.Player)).StatusCode);

            Assert.All(statuses, status => Assert.Equal(HttpStatusCode.NoContent, status));
            Assert.Equal(1, await TombstonesAsync(world.Subjects[A.Player]));
            Assert.Equal(0, await CountAsync("SELECT count(*) FROM groups.members WHERE user_id = @id", world.Users[A.Player]));
            Assert.Equal("left", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).Status);
        }
    }

    /// <summary>C3: the person accepts an invite on another phone while deleting; the sweep leaves no member with the deleted user id.</summary>
    [Fact]
    public async Task DeletionWhileAcceptingAnInvite_LeavesNoMemberOfTheDeletedUser()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);

            var statuses = await RaceAsync(
                async () => (await world.DeleteAccountAsync(A.NonMember)).StatusCode,
                async () => (await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, GroupWorld.TokenBody(world.Invite.Token))).StatusCode);

            Assert.Equal(HttpStatusCode.NoContent, statuses[0]);
            Assert.Equal(0, await CountAsync("SELECT count(*) FROM groups.members WHERE user_id = @id", world.Users[A.NonMember]));
            Assert.Equal(0, await CountAsync("SELECT count(*) FROM identity.users WHERE id = @id", world.Users[A.NonMember]));
        }
    }

    /// <summary>L1: the deletion logs carry no nickname, subject, user id, member id or group name.</summary>
    [Fact]
    public async Task Logs_CarryNothingPersonal()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, GroupName);
        await PutProfileAsync(world, A.Player);
        var start = api.Logs.Count;

        using var blocked = await world.DeleteAccountAsync(A.Admin);
        using var old = await world.DeleteAccountAsync(A.Player, OldLogin);
        using var deleted = await world.DeleteAccountAsync(A.Player);
        using var gone = await world.SendAsync(A.Player, HttpMethod.Post, MePath);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        var entries = api.Logs.EntriesSince(start);
        Assert.Contains(entries, entry => entry.Contains("Account deleted.", StringComparison.Ordinal));
        string[] forbidden =
        [
            PersonNickname, GroupName, world.Subjects[A.Player], world.Subjects[A.Admin], world.Users[A.Player].ToString(),
            world.Users[A.Admin].ToString(), world.MemberIds[A.Player].ToString(), world.MemberIds[A.Admin].ToString(), world.GroupId.ToString(),
        ];
        Assert.DoesNotContain(entries, entry => forbidden.Any(secret => entry.Contains(secret, StringComparison.OrdinalIgnoreCase)));
    }

    private static async Task PutProfileAsync(GroupWorld world, A actor)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: PersonNickname));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>Both calls released together by a barrier; the statuses in the order of the calls.</summary>
    private static async Task<HttpStatusCode[]> RaceAsync(Func<Task<HttpStatusCode>> first, Func<Task<HttpStatusCode>> second)
    {
        using var gate = new Barrier(2);
        var calls = new[] { first, second }.Select(async call =>
        {
            await Task.Yield();
            gate.SignalAndWait(TestContext.Current.CancellationToken);
            return await call();
        });
        return await Task.WhenAll(calls);
    }

    private async Task<long> TombstonesAsync(string subject)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var count = new NpgsqlCommand(
            "SELECT count(*) FROM identity.deleted_accounts WHERE subject_hash = sha256(convert_to(@subject, 'UTF8'))", connection);
        count.Parameters.AddWithValue("subject", subject);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private async Task<long> CountAsync(string sql, object parameter)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var count = new NpgsqlCommand(sql, connection);
        count.Parameters.AddWithValue("id", parameter);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }
}
