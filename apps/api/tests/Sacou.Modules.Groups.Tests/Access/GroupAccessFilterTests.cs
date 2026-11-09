using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Access;

/// <summary>D3 of the plan, without a database: who reaches the handler and what everybody else gets.</summary>
public sealed class GroupAccessFilterTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 9, 12, 0, 0, TimeSpan.Zero);
    private static readonly GroupId Group = new(Guid.CreateVersion7(Now));
    private static readonly UserId Caller = new(Guid.NewGuid());

    private readonly FakeGroupStore store = new();

    [Fact]
    public async Task UnregisteredUser_IsRefusedBeforeAnyLookup()
    {
        var outcome = await RunAsync(userId: null, GroupPermission.ViewGroup);

        AssertProblem(outcome, StatusCodes.Status403Forbidden, CurrentUserErrors.NotRegistered.Code);
        Assert.Equal(0, store.Lookups);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(nameof(MembershipStatus.Left))]
    [InlineData(nameof(MembershipStatus.Removed))]
    public async Task NonMember_GetsTheNotFoundOfAMissingGroup(string? status)
    {
        if (status is not null)
        {
            store.Add(Group, Member(GroupRole.Admin, Enum.Parse<MembershipStatus>(status)));
        }

        var outcome = await RunAsync(Caller.Value, GroupPermission.ViewGroup);

        AssertProblem(outcome, StatusCodes.Status404NotFound, GroupErrors.GroupNotFound.Code);
    }

    [Theory]
    [InlineData(nameof(GroupRole.Scorekeeper))]
    [InlineData(nameof(GroupRole.Player))]
    public async Task MemberWithoutThePermission_IsForbidden(string role)
    {
        store.Add(Group, Member(Enum.Parse<GroupRole>(role), MembershipStatus.Active));

        var outcome = await RunAsync(Caller.Value, GroupPermission.RenameGroup);

        AssertProblem(outcome, StatusCodes.Status403Forbidden, GroupErrors.Forbidden.Code);
    }

    [Fact]
    public async Task MemberWithThePermission_ReachesTheHandlerWithItsAccess()
    {
        var member = Member(GroupRole.CoAdmin, MembershipStatus.Active);
        store.Add(Group, member);

        var outcome = await RunAsync(Caller.Value, GroupPermission.RenameGroup);

        Assert.Equal(new GroupAccess(Group, member), outcome);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    public async Task EndpointWithoutExactlyOnePermission_NeverRuns(int permissions)
    {
        store.Add(Group, Member(GroupRole.Admin, MembershipStatus.Active));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => RunAsync(Caller.Value, [.. Enumerable.Repeat(GroupPermission.ViewGroup, permissions)]));
        Assert.Equal(0, store.Lookups);
    }

    [Fact]
    public async Task GroupIdThatIsNotAGuid_IsNotFound()
    {
        var outcome = await RunAsync(Caller.Value, [GroupPermission.ViewGroup], groupId: "abc");

        AssertProblem(outcome, StatusCodes.Status404NotFound, GroupErrors.GroupNotFound.Code);
        Assert.Equal(0, store.Lookups);
    }

    private static GroupMember Member(GroupRole role, MembershipStatus status) => new(
        MemberId.New(Now), Caller, role, MemberType.DropIn, status, Now, status == MembershipStatus.Active ? null : Now);

    private static void AssertProblem(object? outcome, int status, string code)
    {
        var problem = Assert.IsType<ProblemHttpResult>(outcome);
        Assert.Equal(status, problem.StatusCode);
        Assert.Equal(code, problem.ProblemDetails.Extensions[ProblemResults.CodeExtension]);
    }

    private Task<object?> RunAsync(Guid? userId, GroupPermission permission) => RunAsync(userId, [permission]);

    /// <summary>Returns what the filter answered, or the access the handler would read.</summary>
    private async Task<object?> RunAsync(Guid? userId, GroupPermission[] permissions, string? groupId = null)
    {
        var services = new ServiceCollection()
            .AddSingleton<ICurrentUser>(new FakeCurrentUser(userId))
            .AddSingleton<IGroupStore>(store)
            .BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        http.Request.RouteValues[GroupAccessFilter.GroupIdRouteValue] = groupId ?? Group.Value.ToString();
        http.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(permissions.Select(p => new GroupPermissionMetadata(p))), "test"));

        return await new GroupAccessFilter().InvokeAsync(
            new DefaultEndpointFilterInvocationContext(http),
            context => ValueTask.FromResult<object?>(context.HttpContext.GroupAccess()));
    }
}
