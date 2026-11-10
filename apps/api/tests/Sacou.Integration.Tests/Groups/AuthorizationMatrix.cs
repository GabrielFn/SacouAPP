using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;
using R = Sacou.Integration.Tests.Groups.GroupRoute;

namespace Sacou.Integration.Tests.Groups;

/// <summary>The routes of parts 1 and 2 of E3.2. Part 3 adds the invites, and rows below.</summary>
public enum GroupRoute
{
    CreateGroup,
    ListMyGroups,
    GetGroup,
    RenameGroup,
    ListMembers,
    ChangeRole,
    ChangeType,
    RemoveMember,
    LeaveGroup,
}

/// <summary>
/// M1, the acceptance of E3.2 ("Autorização por papel testada"), for the routes of parts 1 and 2: every actor
/// on every route, with the status and code written by hand from the permission table (docs/dominio/grupos.md),
/// never derived from the production table. No code means a success, or a 401 with no ProblemDetails code.
/// The writes of part 2 aim at the player (role to scorekeeper, type to regular, removal); the admin is the
/// only active admin, so leaving is refused for them alone.
/// </summary>
internal static class AuthorizationMatrix
{
    private const string NotRegistered = "identity.user-not-registered";
    private const string NotFound = "groups.group-not-found";
    private const string Forbidden = "groups.forbidden";
    private const string LastAdmin = "groups.last-admin";

    public static readonly TheoryData<A, R, int, string?> Rows = new()
    {
        { A.Admin, R.CreateGroup, 201, null },
        { A.Admin, R.ListMyGroups, 200, null },
        { A.Admin, R.GetGroup, 200, null },
        { A.Admin, R.RenameGroup, 200, null },
        { A.Admin, R.ListMembers, 200, null },
        { A.Admin, R.ChangeRole, 200, null },
        { A.Admin, R.ChangeType, 200, null },
        { A.Admin, R.RemoveMember, 204, null },
        { A.Admin, R.LeaveGroup, 409, LastAdmin },

        { A.CoAdmin, R.CreateGroup, 201, null },
        { A.CoAdmin, R.ListMyGroups, 200, null },
        { A.CoAdmin, R.GetGroup, 200, null },
        { A.CoAdmin, R.RenameGroup, 200, null },
        { A.CoAdmin, R.ListMembers, 200, null },
        { A.CoAdmin, R.ChangeRole, 200, null },
        { A.CoAdmin, R.ChangeType, 200, null },
        { A.CoAdmin, R.RemoveMember, 204, null },
        { A.CoAdmin, R.LeaveGroup, 204, null },

        { A.Scorekeeper, R.CreateGroup, 201, null },
        { A.Scorekeeper, R.ListMyGroups, 200, null },
        { A.Scorekeeper, R.GetGroup, 200, null },
        { A.Scorekeeper, R.RenameGroup, 403, Forbidden },
        { A.Scorekeeper, R.ListMembers, 200, null },
        { A.Scorekeeper, R.ChangeRole, 403, Forbidden },
        { A.Scorekeeper, R.ChangeType, 403, Forbidden },
        { A.Scorekeeper, R.RemoveMember, 403, Forbidden },
        { A.Scorekeeper, R.LeaveGroup, 204, null },

        { A.Player, R.CreateGroup, 201, null },
        { A.Player, R.ListMyGroups, 200, null },
        { A.Player, R.GetGroup, 200, null },
        { A.Player, R.RenameGroup, 403, Forbidden },
        { A.Player, R.ListMembers, 200, null },
        { A.Player, R.ChangeRole, 403, Forbidden },
        { A.Player, R.ChangeType, 403, Forbidden },
        { A.Player, R.RemoveMember, 403, Forbidden },
        { A.Player, R.LeaveGroup, 204, null },

        { A.LeftMember, R.CreateGroup, 201, null },
        { A.LeftMember, R.ListMyGroups, 200, null },
        { A.LeftMember, R.GetGroup, 404, NotFound },
        { A.LeftMember, R.RenameGroup, 404, NotFound },
        { A.LeftMember, R.ListMembers, 404, NotFound },
        { A.LeftMember, R.ChangeRole, 404, NotFound },
        { A.LeftMember, R.ChangeType, 404, NotFound },
        { A.LeftMember, R.RemoveMember, 404, NotFound },
        { A.LeftMember, R.LeaveGroup, 404, NotFound },

        { A.RemovedMember, R.CreateGroup, 201, null },
        { A.RemovedMember, R.ListMyGroups, 200, null },
        { A.RemovedMember, R.GetGroup, 404, NotFound },
        { A.RemovedMember, R.RenameGroup, 404, NotFound },
        { A.RemovedMember, R.ListMembers, 404, NotFound },
        { A.RemovedMember, R.ChangeRole, 404, NotFound },
        { A.RemovedMember, R.ChangeType, 404, NotFound },
        { A.RemovedMember, R.RemoveMember, 404, NotFound },
        { A.RemovedMember, R.LeaveGroup, 404, NotFound },

        { A.OutsiderMember, R.CreateGroup, 201, null },
        { A.OutsiderMember, R.ListMyGroups, 200, null },
        { A.OutsiderMember, R.GetGroup, 404, NotFound },
        { A.OutsiderMember, R.RenameGroup, 404, NotFound },
        { A.OutsiderMember, R.ListMembers, 404, NotFound },
        { A.OutsiderMember, R.ChangeRole, 404, NotFound },
        { A.OutsiderMember, R.ChangeType, 404, NotFound },
        { A.OutsiderMember, R.RemoveMember, 404, NotFound },
        { A.OutsiderMember, R.LeaveGroup, 404, NotFound },

        { A.NonMember, R.CreateGroup, 201, null },
        { A.NonMember, R.ListMyGroups, 200, null },
        { A.NonMember, R.GetGroup, 404, NotFound },
        { A.NonMember, R.RenameGroup, 404, NotFound },
        { A.NonMember, R.ListMembers, 404, NotFound },
        { A.NonMember, R.ChangeRole, 404, NotFound },
        { A.NonMember, R.ChangeType, 404, NotFound },
        { A.NonMember, R.RemoveMember, 404, NotFound },
        { A.NonMember, R.LeaveGroup, 404, NotFound },

        { A.Unregistered, R.CreateGroup, 403, NotRegistered },
        { A.Unregistered, R.ListMyGroups, 403, NotRegistered },
        { A.Unregistered, R.GetGroup, 403, NotRegistered },
        { A.Unregistered, R.RenameGroup, 403, NotRegistered },
        { A.Unregistered, R.ListMembers, 403, NotRegistered },
        { A.Unregistered, R.ChangeRole, 403, NotRegistered },
        { A.Unregistered, R.ChangeType, 403, NotRegistered },
        { A.Unregistered, R.RemoveMember, 403, NotRegistered },
        { A.Unregistered, R.LeaveGroup, 403, NotRegistered },

        { A.Anonymous, R.CreateGroup, 401, null },
        { A.Anonymous, R.ListMyGroups, 401, null },
        { A.Anonymous, R.GetGroup, 401, null },
        { A.Anonymous, R.RenameGroup, 401, null },
        { A.Anonymous, R.ListMembers, 401, null },
        { A.Anonymous, R.ChangeRole, 401, null },
        { A.Anonymous, R.ChangeType, 401, null },
        { A.Anonymous, R.RemoveMember, 401, null },
        { A.Anonymous, R.LeaveGroup, 401, null },
    };

    public static (HttpMethod Method, string Path, string? Json) Request(GroupWorld world, GroupRoute route) => route switch
    {
        R.CreateGroup => (HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Racha novo"}"""),
        R.ListMyGroups => (HttpMethod.Get, GroupWorld.GroupsPath, null),
        R.GetGroup => (HttpMethod.Get, world.GroupPath, null),
        R.RenameGroup => (HttpMethod.Patch, world.GroupPath, """{"name":"Racha renomeado"}"""),
        R.ListMembers => (HttpMethod.Get, world.GroupPath + "/members", null),
        R.ChangeRole => (HttpMethod.Put, world.MemberPath(world.MemberIds[A.Player]) + "/role", """{"role":"scorekeeper"}"""),
        R.ChangeType => (HttpMethod.Put, world.MemberPath(world.MemberIds[A.Player]) + "/type", """{"memberType":"regular"}"""),
        R.RemoveMember => (HttpMethod.Delete, world.MemberPath(world.MemberIds[A.Player]), null),
        R.LeaveGroup => (HttpMethod.Post, world.GroupPath + "/leave", null),
        _ => throw new ArgumentOutOfRangeException(nameof(route), route, "Every route needs a request."),
    };
}
