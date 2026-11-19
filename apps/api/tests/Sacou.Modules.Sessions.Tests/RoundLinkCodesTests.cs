using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Results;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>Case 1 of the E3.12 plan: a code another round already has is drawn again once; twice in a row is a 500.</summary>
public sealed class RoundLinkCodesTests
{
    private static readonly RoundLinkCode First = RoundLinkCode.TryParse("AAAAAAAAAAAAAAAAAAAAAA")!;
    private static readonly RoundLinkCode Second = RoundLinkCode.TryParse("BBBBBBBBBBBBBBBBBBBBBB")!;

    [Fact]
    public async Task TakenCode_IsDrawnAgain_AndTheRoundGoesInWithTheNewOne()
    {
        var store = new ClashingStore(clashes: 1);
        var codes = new RoundLinkCodes(store, new SequenceGenerator(First, Second));

        var added = await codes.AddAsync(NewRoundToAdd(), TestContext.Current.CancellationToken);

        Assert.Equal(Second, added.Value.Round.LinkCode);
        Assert.Equal([First, Second], store.Tried);
    }

    [Fact]
    public async Task TwoClashesInARow_AreABrokenGenerator()
    {
        var codes = new RoundLinkCodes(new ClashingStore(clashes: 2), new SequenceGenerator(First, First));

        await Assert.ThrowsAsync<InvalidOperationException>(() => codes.AddAsync(NewRoundToAdd(), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task OlderRound_GetsTheStoredCode_AndARoundWithACodeIsLeftAlone()
    {
        var store = new ClashingStore(clashes: 1);
        var codes = new RoundLinkCodes(store, new SequenceGenerator(First, Second));

        var ensured = await codes.EnsureAsync(NewRound(), TestContext.Current.CancellationToken);
        var untouched = await codes.EnsureAsync(NewRound().WithLinkCode(First), TestContext.Current.CancellationToken);

        Assert.Equal(Second, ensured.Value.LinkCode);
        Assert.Equal(First, untouched.Value.LinkCode);
        Assert.Equal([First, Second], store.Tried);
    }

    private static NewRound NewRoundToAdd() => new(RoundChange.Unchanged(NewRound()), NewSeries: null, Now, EnforceLimits: false);

    private sealed class SequenceGenerator(params RoundLinkCode[] codes) : IRoundLinkCodeGenerator
    {
        private int next;

        public RoundLinkCode NewCode() => codes[next++];
    }

    /// <summary>Says the first <paramref name="clashes"/> codes are another round's, then takes the next one.</summary>
    private sealed class ClashingStore(int clashes) : UnsupportedRoundStore
    {
        public List<RoundLinkCode> Tried { get; } = [];

        public override Task<Result<bool>> AddAsync(NewRound added, CancellationToken cancellationToken)
        {
            Tried.Add(added.Change.Round.LinkCode!);
            return Task.FromResult(Tried.Count <= clashes ? Result.Failure<bool>(RoundLinkCodeClash.Taken) : Result.Success(true));
        }

        public override Task<Result<RoundLinkCode>> AssignLinkCodeAsync(GroupId group, RoundId round, RoundLinkCode candidate, CancellationToken cancellationToken)
        {
            Tried.Add(candidate);
            return Task.FromResult(Tried.Count <= clashes ? Result.Failure<RoundLinkCode>(RoundLinkCodeClash.Taken) : Result.Success(candidate));
        }
    }
}
