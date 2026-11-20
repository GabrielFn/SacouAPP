using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Sacou.Modules.Notifications.Contracts;
using Xunit;
using N = Sacou.Integration.Tests.Notifications.NotificationCalls;

namespace Sacou.Integration.Tests.Notifications;

/// <summary>The phones (I11, I12, I16), the list of screen 28 (I15), the export (I14) and the account deletion (I13).</summary>
public sealed class DevicesAndListTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int PageSize = 20;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Theory]
    [InlineData("""{"token":"ExponentPushToken[ab c]","platform":"android"}""", "notifications.token-invalid")]
    [InlineData("""{"token":"FcmToken[abc]","platform":"ios"}""", "notifications.token-invalid")]
    [InlineData("""{"token":"ExponentPushToken[abc]"}""", null)]
    [InlineData("""{"token":"ExponentPushToken[abc]","platform":"windows"}""", null)]
    [InlineData("""{"token":"ExponentPushToken[abc]","platform":"android","userId":"x"}""", null)]
    public async Task Register_OutOfShape_Is400(string body, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(GroupActor.Player, HttpMethod.Put, N.DevicePath(Guid.NewGuid()), body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        if (code is not null)
        {
            Assert.Equal(code, await RoundCalls.CodeAsync(response));
        }

        Assert.DoesNotContain("ExponentPushToken", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
    }

    [Fact]
    public async Task I11_ATokenOfAnotherAccount_LeavesIt_AndItsPendingPushesGoWithIt()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var lender = await world.AddPersonAsync();
        var borrower = await world.AddPersonAsync();
        var token = N.Token();
        await N.RegisterAsync(world, lender.Subject, Guid.NewGuid(), token);
        await N.RequestAsync(api, Request(world.GroupId, lender.MemberId));

        await N.RegisterAsync(world, borrower.Subject, Guid.NewGuid(), token);

        Assert.Equal(1, await DevicesWithAsync(token));
        Assert.Equal(0, await N.DeliveriesOfMemberAsync(api.ConnectionString, lender.MemberId));
        await N.RequestAsync(api, Request(world.GroupId, lender.MemberId));
        Assert.Equal(0, await N.DeliveriesOfMemberAsync(api.ConnectionString, lender.MemberId));
        await N.RequestAsync(api, Request(world.GroupId, borrower.MemberId));
        Assert.Equal(1, await N.DeliveriesOfMemberAsync(api.ConnectionString, borrower.MemberId));
    }

    [Fact]
    public async Task Register_Again_IsIdempotent_AndANewTokenReplacesTheOld()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var person = await world.AddPersonAsync();
        var installation = Guid.NewGuid();
        var first = N.Token();
        var second = N.Token();

        await N.RegisterAsync(world, person.Subject, installation, first);
        await N.RegisterAsync(world, person.Subject, installation, first);
        await N.RegisterAsync(world, person.Subject, installation, second);

        Assert.Equal(0, await DevicesWithAsync(first));
        Assert.Equal(1, await DevicesWithAsync(second));
        Assert.Equal(1, await N.CountAsync(api.ConnectionString, "SELECT count(*) FROM notifications.push_devices WHERE installation_id = @id", ("id", installation)));
    }

    [Fact]
    public async Task I12_TheSixthPhone_TurnsTheLeastRecentOff()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var person = await world.AddPersonAsync();
        var tokens = Enumerable.Range(0, 6).Select(_ => N.Token()).ToList();
        foreach (var token in tokens)
        {
            await N.RegisterAsync(world, person.Subject, Guid.NewGuid(), token);
            api.Clock.SetNow(api.Clock.GetUtcNow() + TimeSpan.FromMinutes(1));
        }

        Assert.Equal(1, await N.CountAsync(
            api.ConnectionString,
            "SELECT count(*) FROM notifications.push_devices WHERE expo_token = @token AND disabled_reason = 'over_device_limit'",
            ("token", tokens[0])));
        Assert.Equal(5, await N.CountAsync(
            api.ConnectionString,
            "SELECT count(*) FROM notifications.push_devices WHERE expo_token = ANY (@tokens) AND disabled_at IS NULL",
            ("tokens", tokens.ToArray())));
    }

    [Fact]
    public async Task I16_RemovingAnotherAccountsInstallation_Is204_AndChangesNothing()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var owner = await world.AddPersonAsync();
        var installation = Guid.NewGuid();
        var token = N.Token();
        await N.RegisterAsync(world, owner.Subject, installation, token);

        using var foreign = await world.SendAsync(GroupActor.Player, HttpMethod.Delete, N.DevicePath(installation));
        Assert.Equal(HttpStatusCode.NoContent, foreign.StatusCode);
        Assert.Equal(1, await DevicesWithAsync(token));

        using var own = await world.SendAsAsync(owner.Subject, HttpMethod.Delete, N.DevicePath(installation));
        using var again = await world.SendAsAsync(owner.Subject, HttpMethod.Delete, N.DevicePath(installation));
        Assert.Equal(HttpStatusCode.NoContent, own.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Equal(0, await DevicesWithAsync(token));
    }

    [Fact]
    public async Task I15_TheList_IsTheOwnersOnly_Paged_WithTheUnreadCount()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, "Areia");
        var person = await world.AddPersonAsync();
        var round = Guid.Parse((await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>());
        for (var notification = 0; notification <= PageSize; notification++)
        {
            await N.RequestAsync(api, Request(world.GroupId, person.MemberId, round));
            api.Clock.SetNow(api.Clock.GetUtcNow() + TimeSpan.FromSeconds(1));
        }

        var first = await N.ListAsync(world, person.Subject);
        var second = await N.ListAsync(world, person.Subject, first["nextCursor"]!.GetValue<string>());
        Assert.Equal(PageSize, first["items"]!.AsArray().Count);
        Assert.Equal(PageSize + 1, first["unreadCount"]!.GetValue<int>());
        Assert.Single(second["items"]!.AsArray());
        Assert.Null(second["nextCursor"]);
        var item = first["items"]![0]!;
        Assert.StartsWith("Você saiu da espera: entrou no Areia de ", item["title"]!.GetValue<string>(), StringComparison.Ordinal);
        Assert.EndsWith(" · Quadra 3", item["subtitle"]!.GetValue<string>(), StringComparison.Ordinal);
        Assert.Equal("no-store", (await RawListAsync(world, person.Subject)).Headers.CacheControl?.ToString());

        var id = item["id"]!.GetValue<string>();
        using var foreign = await world.SendAsync(GroupActor.Player, HttpMethod.Post, $"{N.ListPath}/{id}/read");
        using var missing = await world.SendAsAsync(person.Subject, HttpMethod.Post, $"{N.ListPath}/{Guid.NewGuid()}/read");
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        Assert.Equal(await RoundCalls.CodeAsync(missing), await RoundCalls.CodeAsync(foreign));
        Assert.Empty((await N.ListAsync(world, world.Subjects[GroupActor.Player]))["items"]!.AsArray());

        using var one = await world.SendAsAsync(person.Subject, HttpMethod.Post, $"{N.ListPath}/{id}/read");
        Assert.Equal(HttpStatusCode.NoContent, one.StatusCode);
        Assert.Equal(PageSize, (await N.ListAsync(world, person.Subject))["unreadCount"]!.GetValue<int>());
        using var all = await world.SendAsAsync(person.Subject, HttpMethod.Post, $"{N.ListPath}/read-all");
        Assert.Equal(HttpStatusCode.NoContent, all.StatusCode);
        Assert.Equal(0, (await N.ListAsync(world, person.Subject))["unreadCount"]!.GetValue<int>());
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("1.2")]
    public async Task List_WithAForeignCursor_IsCursorInvalid(string cursor)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(GroupActor.Player, HttpMethod.Get, $"{N.ListPath}?cursor={cursor}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("notifications.cursor-invalid", await RoundCalls.CodeAsync(response));
    }

    [Fact]
    public async Task I14_TheExport_HasThePhonesWithoutTokenNorInstallation()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var token = N.Token();
        var installation = Guid.NewGuid();
        await N.RegisterAsync(world, world.Subjects[GroupActor.Player], installation, token);
        await N.RequestAsync(api, Request(world.GroupId, world.MemberIds[GroupActor.Player]));

        using var export = await world.SendAsync(GroupActor.Player, HttpMethod.Get, "/v1/me/export");
        var text = await export.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        var section = (await RoundCalls.JsonAsync(export))["notifications"]!;
        Assert.Equal("android", section["devices"]![0]!["platform"]!.GetValue<string>());
        Assert.Single(section["notifications"]!.AsArray());
        Assert.DoesNotContain(token, text, StringComparison.Ordinal);
        Assert.DoesNotContain(installation.ToString(), text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task I13_DeletingTheAccount_ErasesThePhonesAndTheNotifications()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var person = await world.AddPersonAsync();
        var token = N.Token();
        await N.RegisterAsync(world, person.Subject, Guid.NewGuid(), token);
        await N.RequestAsync(api, Request(world.GroupId, person.MemberId));
        Assert.Equal(1, await N.DeliveriesOfMemberAsync(api.ConnectionString, person.MemberId));

        using var deleted = await world.DeleteAccountAsync(person.Subject);
        using var again = await world.DeleteAccountAsync(person.Subject);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Equal(0, await DevicesWithAsync(token));
        Assert.Equal(0, await N.NotificationsOfMemberAsync(api.ConnectionString, person.MemberId));
        Assert.Equal(0, await N.DeliveriesOfMemberAsync(api.ConnectionString, person.MemberId));
        await N.RequestAsync(api, Request(world.GroupId, person.MemberId));
        Assert.Equal(0, await N.NotificationsOfMemberAsync(api.ConnectionString, person.MemberId));
    }

    private Task<long> DevicesWithAsync(string token) =>
        N.CountAsync(api.ConnectionString, "SELECT count(*) FROM notifications.push_devices WHERE expo_token = @token", ("token", token));

    private static async Task<HttpResponseMessage> RawListAsync(GroupWorld world, string subject) =>
        await world.SendAsAsync(subject, HttpMethod.Get, N.ListPath);

    private static NotificationRequest Request(Guid group, Guid member, Guid? round = null) =>
        new($"test:{Guid.NewGuid():N}", NotificationRequestKind.WaitlistPromoted, member, group, round ?? Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(2));
}
