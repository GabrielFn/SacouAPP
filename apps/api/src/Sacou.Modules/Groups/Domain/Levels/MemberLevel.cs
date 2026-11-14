using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Shared.Levels;
using Sacou.Shared.Members;

namespace Sacou.Modules.Groups.Domain.Levels;

/// <summary>
/// The admin's private level of one member (ADR 0047, ADR 0051 D2). The row exists once an admin or co-admin
/// reviewed the member; a null <see cref="Level"/> is "Não sei", which resolves to the suggestion or the default.
/// The author is a <see cref="MemberId"/>, never a user id, and no response ever shows it.
/// </summary>
internal sealed record MemberLevel(MemberId MemberId, GroupId GroupId, SkillLevel? Level, MemberId SetBy, DateTimeOffset SetAt);

/// <summary>One item of a write: the member and the level the admin gave, null for "Não sei".</summary>
internal sealed record LevelAssignment(MemberId MemberId, SkillLevel? Level);
