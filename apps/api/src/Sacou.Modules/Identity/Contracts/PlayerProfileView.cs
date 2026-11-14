namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// A profile as another module sees it. <see cref="SuggestedLevelTenths"/> is private: only the admin's level
/// routes and the level contract (ADR 0051, D7 and D9) may put it in an answer, never the member list.
/// </summary>
public sealed record PlayerProfileView(
    Guid UserId,
    string Nickname,
    PrimaryPosition? PrimaryPosition,
    IReadOnlyList<PlayingPosition> OtherPositions,
    int? SuggestedLevelTenths);
