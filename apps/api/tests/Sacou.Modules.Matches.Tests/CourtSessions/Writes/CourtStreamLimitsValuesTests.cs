using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>
/// Pins each ceiling of D9 to the number written in ADR 0060. The other limit tests read the constants,
/// so a changed value would move the test with it; here a change must be a deliberate edit of the ADR too.
/// </summary>
public sealed class CourtStreamLimitsValuesTests
{
    private const int KibiBytes = 1024;
    private const int MebiBytes = 1024 * 1024;

    [Fact]
    public void Ceilings_AreTheOnesOfTheAdr()
    {
        Assert.Equal(256 * KibiBytes, CourtStreamLimits.MaxRequestBytes);
        Assert.Equal(1, CourtStreamLimits.MinEventsPerRequest);
        Assert.Equal(200, CourtStreamLimits.MaxEventsPerRequest);
        Assert.Equal(16 * KibiBytes, CourtStreamLimits.MaxEnvelopeBytes);
        Assert.Equal(20_000, CourtStreamLimits.MaxStreamEvents);
        Assert.Equal(8L * MebiBytes, CourtStreamLimits.MaxStreamBytes);
        Assert.Equal(1_500, CourtStreamLimits.MaxMatchEvents);
        Assert.Equal(120, CourtStreamLimits.MaxMatchLineupChanges);
        Assert.Equal(60, CourtStreamLimits.MaxMatchServingChanges);
        Assert.Equal(300, CourtStreamLimits.MaxMatchReverts);
        Assert.Equal(3, CourtStreamLimits.MaxPointAttributions);
        Assert.Equal(300, CourtStreamLimits.MaxStreamQueueChanges);
    }
}
