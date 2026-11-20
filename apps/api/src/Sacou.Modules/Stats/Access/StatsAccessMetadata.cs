using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Stats.Access;

/// <summary>The one capability a stats endpoint requires. More or fewer than one is a 500 and a failing route guard test.</summary>
internal sealed record StatsCapabilityMetadata(GroupCapability Capability);

/// <summary>Added with the filter, by the same call, so the route guard test can see that the filter is there.</summary>
internal sealed class StatsAccessFilterMetadata
{
    public static readonly StatsAccessFilterMetadata Instance = new();

    private StatsAccessFilterMetadata()
    {
    }
}
