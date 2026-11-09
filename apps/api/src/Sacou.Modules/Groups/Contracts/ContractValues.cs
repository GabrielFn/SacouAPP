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
}
