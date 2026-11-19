using System.Net;
using Xunit;

namespace Sacou.Api.Tests.OpenApi;

/// <summary>
/// C1, C2, C11, C12 (E4.2): the contract the app compiles against is the one the API serves, it lists exactly
/// the routes of v1, and it exists only on a developer machine, without saying which machine.
/// </summary>
public sealed class OpenApiContractTests
{
    /// <summary>A new route means a reviewed change here and in the app (E4.2, C2).</summary>
    private static readonly string[] ExpectedOperations =
    [
        "post /v1/me SignIn",
        "get /v1/me/profile GetMyProfile",
        "put /v1/me/profile SaveMyProfile",
        "get /v1/me/export ExportMyData",
        "get /v1/me/deletion-blockers GetDeletionBlockers",
        "delete /v1/me DeleteMyAccount",
        "post /v1/groups CreateGroup",
        "get /v1/groups ListMyGroups",
        "post /v1/invites/preview PreviewInvite",
        "post /v1/invites/accept AcceptInvite",
        "post /v1/round-links/resolve ResolveRoundLink",
        "post /v1/round-links/attendance AnswerByRoundLink",
        "get /v1/groups/{groupId} GetGroup",
        "patch /v1/groups/{groupId} RenameGroup",
        "get /v1/groups/{groupId}/members ListGroupMembers",
        "put /v1/groups/{groupId}/members/{memberId}/role ChangeMemberRole",
        "put /v1/groups/{groupId}/members/{memberId}/type ChangeMemberType",
        "delete /v1/groups/{groupId}/members/{memberId} RemoveGroupMember",
        "post /v1/groups/{groupId}/leave LeaveGroup",
        "post /v1/groups/{groupId}/invites CreateGroupInvite",
        "get /v1/groups/{groupId}/invites ListGroupInvites",
        "delete /v1/groups/{groupId}/invites/{inviteId} RevokeGroupInvite",
        "get /v1/groups/{groupId}/settings GetGroupSettings",
        "patch /v1/groups/{groupId}/settings UpdateGroupSettings",
        "post /v1/groups/{groupId}/settings/apply-template ApplyGroupSettingsTemplate",
        "get /v1/groups/{groupId}/templates ListGroupTemplates",
        "post /v1/groups/{groupId}/templates SaveGroupTemplate",
        "delete /v1/groups/{groupId}/templates/{templateId} DeleteGroupTemplate",
        "get /v1/groups/{groupId}/member-levels ListMemberLevels",
        "put /v1/groups/{groupId}/member-levels/{memberId} SetMemberLevel",
        "put /v1/groups/{groupId}/member-levels SetMemberLevels",
        "post /v1/groups/{groupId}/guests AddGuest",
        "put /v1/groups/{groupId}/guests/{memberId} CorrectGuest",
        "post /v1/groups/{groupId}/rounds CreateRound",
        "get /v1/groups/{groupId}/rounds ListRounds",
        "get /v1/groups/{groupId}/rounds/{roundId} GetRound",
        "patch /v1/groups/{groupId}/rounds/{roundId} UpdateRound",
        "post /v1/groups/{groupId}/rounds/{roundId}/cancel CancelRound",
        "put /v1/groups/{groupId}/rounds/{roundId}/attendance/me RespondAttendance",
        "put /v1/groups/{groupId}/rounds/{roundId}/attendance/{memberId} SetMemberAttendance",
        "post /v1/groups/{groupId}/rounds/{roundId}/draw DrawTeams",
        "post /v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/events AppendCourtEvents",
        "get /v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/events ListCourtEvents",
        "post /v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/takeover TakeOverCourt",
        "get /v1/groups/{groupId}/rounds/{roundId}/court-session GetCourtSession",
        "post /v1/groups/{groupId}/series/{seriesId}/stop StopSeries",
    ];

    /// <summary>
    /// The acceptance of E4.2, link 1: a DTO changed without regenerating fails here. With
    /// <c>SACOU_UPDATE_OPENAPI=1</c> (<c>pnpm api:contract</c>) the test writes the file instead.
    /// </summary>
    [Fact]
    public async Task Document_matches_committed_file()
    {
        var served = await ContractDocument.FetchAsync();

        if (Environment.GetEnvironmentVariable(ContractDocument.UpdateVariable) == "1")
        {
            await File.WriteAllTextAsync(ContractDocument.CommittedPath, served, TestContext.Current.CancellationToken);
            return;
        }

        var committed = await File.ReadAllTextAsync(ContractDocument.CommittedPath, TestContext.Current.CancellationToken);
        Assert.True(
            committed.ReplaceLineEndings("\n") == served,
            "apps/api/openapi/v1.json is not the document the API serves: run `pnpm api:contract` and commit the result.");
    }

    [Fact]
    public async Task Document_is_the_same_twice()
    {
        Assert.Equal(await ContractDocument.FetchAsync(), await ContractDocument.FetchAsync());
    }

    [Fact]
    public async Task Every_operation_is_named_and_expected()
    {
        var document = await ContractDocument.ParsedAsync();

        var operations = OpenApiNodes.Operations(document)
            .Select(operation => $"{operation.Method} {operation.Path} {(string?)operation.Node["operationId"] ?? "<unnamed>"}");

        Assert.Equal(ExpectedOperations.Order(StringComparer.Ordinal), operations.Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task Document_says_nothing_about_the_machine()
    {
        var text = await ContractDocument.FetchAsync();

        Assert.DoesNotContain("\"servers\"", text, StringComparison.Ordinal);
        Assert.DoesNotContain(Environment.MachineName, text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar), text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(SacouApiFactory.TestProjectId, text, StringComparison.Ordinal);
        Assert.DoesNotContain("ProjectId", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("localhost", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Development_serves_the_document_without_a_token()
    {
        await using var factory = new SacouApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(ContractDocument.DocumentPath, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>D2: never published. 401 from the fallback policy or 404, anything but the document.</summary>
    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task Outside_development_the_document_is_not_served(string environment)
    {
        await using var factory = new SacouApiFactory { Environment = environment };
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(ContractDocument.DocumentPath, TestContext.Current.CancellationToken);

        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.NotFound });
    }
}
