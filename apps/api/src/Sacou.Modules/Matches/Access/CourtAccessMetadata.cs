using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Matches.Access;

/// <summary>The one capability a court endpoint requires. More or fewer than one is a 500 and a failing route guard test.</summary>
internal sealed record CourtCapabilityMetadata(GroupCapability Capability);

/// <summary>Added with the filter, by the same call, so the route guard test can see that the filter is there.</summary>
internal sealed class CourtAccessFilterMetadata
{
    public static readonly CourtAccessFilterMetadata Instance = new();

    private CourtAccessFilterMetadata()
    {
    }
}
