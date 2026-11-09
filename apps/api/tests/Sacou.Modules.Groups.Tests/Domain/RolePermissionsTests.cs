using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Xunit;
using P = Sacou.Modules.Groups.Domain.Permissions.GroupPermission;
using R = Sacou.Modules.Groups.Domain.Members.GroupRole;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>
/// D3: all 36 combinations against a table written by hand from docs/dominio/grupos.md (Gabriel's answer
/// to question 16), never derived from the production table.
/// </summary>
public sealed class RolePermissionsTests
{
    private const int RoleCount = 4;
    private const int PermissionCount = 9;

    public static readonly TheoryData<string, string, bool> Table = new()
    {
        { nameof(R.Admin), nameof(P.ViewGroup), true },
        { nameof(R.Admin), nameof(P.RenameGroup), true },
        { nameof(R.Admin), nameof(P.ManageInvites), true },
        { nameof(R.Admin), nameof(P.ChangeMemberType), true },
        { nameof(R.Admin), nameof(P.AssignBasicRole), true },
        { nameof(R.Admin), nameof(P.AssignAdminRole), true },
        { nameof(R.Admin), nameof(P.RemoveMember), true },
        { nameof(R.Admin), nameof(P.RemoveAdmin), true },
        { nameof(R.Admin), nameof(P.Leave), true },
        { nameof(R.CoAdmin), nameof(P.ViewGroup), true },
        { nameof(R.CoAdmin), nameof(P.RenameGroup), true },
        { nameof(R.CoAdmin), nameof(P.ManageInvites), true },
        { nameof(R.CoAdmin), nameof(P.ChangeMemberType), true },
        { nameof(R.CoAdmin), nameof(P.AssignBasicRole), true },
        { nameof(R.CoAdmin), nameof(P.AssignAdminRole), false },
        { nameof(R.CoAdmin), nameof(P.RemoveMember), true },
        { nameof(R.CoAdmin), nameof(P.RemoveAdmin), false },
        { nameof(R.CoAdmin), nameof(P.Leave), true },
        { nameof(R.Scorekeeper), nameof(P.ViewGroup), true },
        { nameof(R.Scorekeeper), nameof(P.RenameGroup), false },
        { nameof(R.Scorekeeper), nameof(P.ManageInvites), false },
        { nameof(R.Scorekeeper), nameof(P.ChangeMemberType), false },
        { nameof(R.Scorekeeper), nameof(P.AssignBasicRole), false },
        { nameof(R.Scorekeeper), nameof(P.AssignAdminRole), false },
        { nameof(R.Scorekeeper), nameof(P.RemoveMember), false },
        { nameof(R.Scorekeeper), nameof(P.RemoveAdmin), false },
        { nameof(R.Scorekeeper), nameof(P.Leave), true },
        { nameof(R.Player), nameof(P.ViewGroup), true },
        { nameof(R.Player), nameof(P.RenameGroup), false },
        { nameof(R.Player), nameof(P.ManageInvites), false },
        { nameof(R.Player), nameof(P.ChangeMemberType), false },
        { nameof(R.Player), nameof(P.AssignBasicRole), false },
        { nameof(R.Player), nameof(P.AssignAdminRole), false },
        { nameof(R.Player), nameof(P.RemoveMember), false },
        { nameof(R.Player), nameof(P.RemoveAdmin), false },
        { nameof(R.Player), nameof(P.Leave), true },
    };

    [Theory]
    [MemberData(nameof(Table))]
    public void Allows_MatchesTheTable(string role, string permission, bool allowed)
    {
        Assert.Equal(allowed, RolePermissions.Allows(Enum.Parse<GroupRole>(role), Enum.Parse<GroupPermission>(permission)));
    }

    /// <summary>A new role or permission fails here until it gets its rows above.</summary>
    [Fact]
    public void Table_CoversEveryRoleAndPermissionOnce()
    {
        Assert.Equal(RoleCount, Enum.GetValues<GroupRole>().Length);
        Assert.Equal(PermissionCount, Enum.GetValues<GroupPermission>().Length);
        var pairs = Table.Select(row => (row.Data.Item1, row.Data.Item2)).ToHashSet();
        Assert.Equal(RoleCount * PermissionCount, pairs.Count);
        Assert.Equal(Table.Count, pairs.Count);
    }

    [Fact]
    public void UnknownRole_HasNoPermission()
    {
        Assert.All(Enum.GetValues<GroupPermission>(), permission => Assert.False(RolePermissions.Allows((GroupRole)99, permission)));
    }
}
