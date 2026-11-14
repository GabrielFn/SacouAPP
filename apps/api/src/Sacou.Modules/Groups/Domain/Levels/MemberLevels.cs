using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Levels;

/// <summary>What a level write sees under the group lock: the group's members, active or not (ADR 0051, D10).</summary>
internal sealed record MemberLevelContext(GroupId GroupId, ImmutableArray<GroupMember> Members);

/// <summary>The levels to write, one per member, in the order of the request. All of them or none.</summary>
internal sealed record MemberLevelChange(ImmutableArray<MemberLevel> Levels);

/// <summary>
/// The rule of a level write (ADR 0051, D8 and D10), judged on the members read under the group lock: an actor
/// demoted or removed after the access filter loses. Order: the actor, the shape of the batch, then every target.
/// Any target may be given a level, admins and the actor included: the level gives no power in the group.
/// </summary>
internal static class MemberLevels
{
    public static Result<MemberLevelChange> Set(
        MemberLevelContext context, MemberId actorId, IReadOnlyList<LevelAssignment> assignments, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(assignments);
        var actor = FindActive(context, actorId);
        if (actor is null)
        {
            return Result.Failure<MemberLevelChange>(GroupErrors.GroupNotFound);
        }

        if (!RolePermissions.Allows(actor.Role, GroupPermission.ManageMemberLevels))
        {
            return Result.Failure<MemberLevelChange>(GroupErrors.Forbidden);
        }

        if (!IsValidBatch(assignments))
        {
            return Result.Failure<MemberLevelChange>(GroupErrors.LevelInvalid);
        }

        if (assignments.Any(assignment => FindActive(context, assignment.MemberId) is null))
        {
            return Result.Failure<MemberLevelChange>(GroupErrors.MemberNotFound);
        }

        return Result.Success(new MemberLevelChange(
            [.. assignments.Select(assignment => new MemberLevel(assignment.MemberId, context.GroupId, assignment.Level, actor.Id, now))]));
    }

    private static bool IsValidBatch(IReadOnlyList<LevelAssignment> assignments) =>
        assignments.Count is > 0 and <= MemberLevelLimits.MaxBatch
        && assignments.Select(assignment => assignment.MemberId).Distinct().Count() == assignments.Count;

    private static GroupMember? FindActive(MemberLevelContext context, MemberId id) =>
        context.Members.SingleOrDefault(member => member.Id == id && member.IsActive);
}
