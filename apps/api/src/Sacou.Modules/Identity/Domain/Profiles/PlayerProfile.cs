using Sacou.Modules.Identity.Domain.Users;
using Sacou.Shared.Levels;

namespace Sacou.Modules.Identity.Domain.Profiles;

/// <summary>
/// The person's profile, one for every group (ADR 0051, D1): the nickname, the positions and the level the
/// person suggests for themselves (screen 27), which only they and the admins of their groups see. Nothing
/// else: no full name, e-mail, photo, gender or birth date. A new field changes docs/seguranca/dados-pessoais.md
/// and the model test.
/// </summary>
internal sealed record PlayerProfile(
    UserId UserId,
    Nickname Nickname,
    PlayerPositions Positions,
    SkillLevel? SuggestedLevel,
    DateTimeOffset UpdatedAt);
