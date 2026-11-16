using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Shared.Members;

namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>
/// When a group stops the person from deleting the account (E3.16, ADR 0056, D3): they are its only active admin
/// and another active member has an account, so someone can be promoted first (screen 19). A co-admin is not an
/// admin (<c>grupos.md</c>). Alone, or with only guests or former members left, nothing blocks: there is no one
/// to hand the group to. Never an automatic promotion.
/// </summary>
internal static class DeletionRules
{
    public static bool IsDeletionBlocker(Group group, MemberId member)
    {
        ArgumentNullException.ThrowIfNull(group);
        var person = group.ActiveMembers.SingleOrDefault(candidate => candidate.Id == member);
        if (person is null || !person.IsActiveAdmin)
        {
            return false;
        }

        var others = group.ActiveMembers.Where(candidate => candidate.Id != member).ToList();
        return !others.Any(candidate => candidate.IsActiveAdmin) && others.Any(candidate => candidate.HasAccount);
    }
}
