using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Identity.Contracts;
using DomainRole = Sacou.Modules.Groups.Domain.Members.GroupRole;
using DomainType = Sacou.Modules.Groups.Domain.Members.MemberType;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>Domain enums to the public ones, by name, so a new domain value without a public twin fails loudly.</summary>
internal static class ContractValues
{
    public static GroupRole ToContract(DomainRole role) => role switch
    {
        DomainRole.Admin => GroupRole.Admin,
        DomainRole.CoAdmin => GroupRole.CoAdmin,
        DomainRole.Scorekeeper => GroupRole.Scorekeeper,
        DomainRole.Player => GroupRole.Player,
        _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Every role needs a public twin."),
    };

    public static MemberType ToContract(DomainType type) => type switch
    {
        DomainType.Regular => MemberType.Regular,
        DomainType.DropIn => MemberType.DropIn,
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, "Every member type needs a public twin."),
    };

    /// <summary>A guest's position, in the public enum of the player's profile, so the member list has one shape (ADR 0053, D10).</summary>
    public static PlayingPosition ToContract(GuestPosition position) => position switch
    {
        GuestPosition.Setter => PlayingPosition.Setter,
        GuestPosition.OutsideHitter => PlayingPosition.OutsideHitter,
        GuestPosition.Opposite => PlayingPosition.Opposite,
        GuestPosition.MiddleBlocker => PlayingPosition.MiddleBlocker,
        GuestPosition.Libero => PlayingPosition.Libero,
        _ => throw new ArgumentOutOfRangeException(nameof(position), position, "Every guest position needs a public twin."),
    };

    public static PrimaryPosition ToPrimary(GuestPosition position) => position switch
    {
        GuestPosition.Setter => PrimaryPosition.Setter,
        GuestPosition.OutsideHitter => PrimaryPosition.OutsideHitter,
        GuestPosition.Opposite => PrimaryPosition.Opposite,
        GuestPosition.MiddleBlocker => PrimaryPosition.MiddleBlocker,
        GuestPosition.Libero => PrimaryPosition.Libero,
        _ => throw new ArgumentOutOfRangeException(nameof(position), position, "Every guest position needs a public twin."),
    };

    public static GroupPermission ToDomain(GroupCapability capability) => capability switch
    {
        GroupCapability.ViewGroup => GroupPermission.ViewGroup,
        GroupCapability.ManageRounds => GroupPermission.ManageRounds,
        GroupCapability.RespondAttendance => GroupPermission.RespondAttendance,
        _ => throw new ArgumentOutOfRangeException(nameof(capability), capability, "Every capability needs a domain permission."),
    };

    public static DomainRole ToDomain(GroupRole role) => role switch
    {
        GroupRole.Admin => DomainRole.Admin,
        GroupRole.CoAdmin => DomainRole.CoAdmin,
        GroupRole.Scorekeeper => DomainRole.Scorekeeper,
        GroupRole.Player => DomainRole.Player,
        _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Every public role needs a domain twin."),
    };

    public static DomainType ToDomain(MemberType type) => type switch
    {
        MemberType.Regular => DomainType.Regular,
        MemberType.DropIn => DomainType.DropIn,
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, "Every public member type needs a domain twin."),
    };
}
