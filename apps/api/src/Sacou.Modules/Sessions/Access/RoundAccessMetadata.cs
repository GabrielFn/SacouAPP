using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Sessions.Access;

/// <summary>The one capability a round endpoint requires. More or fewer than one is a 500 and a failing route guard test.</summary>
internal sealed record RoundCapabilityMetadata(GroupCapability Capability);

/// <summary>Added with the filter, by the same call, so the route guard test can see that the filter is there.</summary>
internal sealed class RoundAccessFilterMetadata
{
    public static readonly RoundAccessFilterMetadata Instance = new();

    private RoundAccessFilterMetadata()
    {
    }
}
