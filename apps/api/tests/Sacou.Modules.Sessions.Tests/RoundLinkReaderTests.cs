using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RoundLinks;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>Case 2 of the E3.12 plan: a malformed code costs no query, and gets the answer of a code that found nothing.</summary>
public sealed class RoundLinkReaderTests
{
    [Theory]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn-")]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn+_")]
    [InlineData(null)]
    public async Task MalformedCode_IsRefused_WithoutAQuery(string? code)
    {
        var store = new CountingStore();

        var found = await new RoundLinkReader(store).FindAsync(code, TestContext.Current.CancellationToken);

        Assert.Equal(RoundErrors.RoundLinkInvalid, found.Error);
        Assert.Equal(0, store.Lookups);
    }

    [Fact]
    public async Task WellFormedCodeOfNoRound_IsTheSameRefusal_AfterOneQuery()
    {
        var store = new CountingStore();

        var found = await new RoundLinkReader(store).FindAsync("AAAAAAAAAAAAAAAAAAAAAA", TestContext.Current.CancellationToken);

        Assert.Equal(RoundErrors.RoundLinkInvalid, found.Error);
        Assert.Equal(1, store.Lookups);
    }

    private sealed class CountingStore : UnsupportedRoundStore
    {
        public int Lookups { get; private set; }

        public override Task<Round?> FindByLinkCodeAsync(RoundLinkCode code, CancellationToken cancellationToken)
        {
            Lookups++;
            return Task.FromResult<Round?>(null);
        }
    }
}
