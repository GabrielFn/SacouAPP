using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Profiles;
using ContractPlaying = Sacou.Modules.Identity.Contracts.PlayingPosition;
using ContractPrimary = Sacou.Modules.Identity.Contracts.PrimaryPosition;

namespace Sacou.Modules.Identity.GetMyProfile;

/// <summary>
/// The body of <c>GET</c> and <c>PUT /v1/me/profile</c>. The person's own suggested level comes back to them, and
/// only here (ADR 0051, D7): the admin's note never does. No user id: the route already says whose it is.
/// </summary>
internal sealed record MyProfileResponse(
    string Nickname,
    ContractPrimary? PrimaryPosition,
    IReadOnlyList<ContractPlaying> OtherPositions,
    decimal? SuggestedLevel)
{
    public static MyProfileResponse From(PlayerProfile profile) => new(
        profile.Nickname.Value,
        profile.Positions.Primary is { } primary ? ProfileContractValues.ToContract(primary) : null,
        [.. profile.Positions.Others.Select(ProfileContractValues.ToContract)],
        profile.SuggestedLevel?.ToDecimal());
}

/// <summary>The route of the person's own profile, outside any group (on the closed list of the route guard).</summary>
internal static class MyProfileRoute
{
    public const string Path = "/v1/me/profile";

    /// <summary>The same cap as the group routes: a 20-character nickname and five positions fit with room to spare.</summary>
    public const long MaxBodyBytes = 4 * 1024;
}
