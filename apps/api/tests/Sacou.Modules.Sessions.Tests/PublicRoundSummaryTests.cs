using System.Collections.Immutable;
using System.Reflection;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RoundLinks;
using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>The public line of a round (ADR 0070, D2): its state, its counts and its format, and nothing of a member.</summary>
public sealed class PublicRoundSummaryTests
{
    private const string GroupName = "Vôlei de terça";
    private const int Capacity = 2;
    private const int PointsPerSet = 21;
    private const int IndoorPlayers = 6;
    private const string AnyCode = "AAAAAAAAAAAAAAAAAAAAAA";

    private static readonly IReadOnlyDictionary<Guid, ListName> NoNames = new Dictionary<Guid, ListName>();

    private static readonly AttendanceRules LimitedWithWaitlist = new(
        Enabled: true, CapacityLimited: true, Capacity, WaitlistEnabled: true, RegularsEnabled: false, DropInWindowEnabled: false, DropInOpensHoursBefore: 24);

    [Fact]
    public void OpenRound_WithRoom_IsOpen_AndCarriesTheCountsAndTheFormat()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, NoNames);

        Assert.Equal(
            summary with { Going = [] },
            new PublicRoundSummary(
                GroupName,
                RoundFormat.Date(RoundFixture.RoundDate),
                RoundFormat.Time(RoundFixture.RoundTime),
                round.Slot.TimeZoneId,
                round.Slot.StartsAt,
                round.Venue.Value,
                PublicRoundState.Open,
                Capacity,
                GoingCount: 1,
                WaitlistCount: 0,
                WaitlistEnabled: true,
                IndoorPlayers,
                PointsPerSet,
                LoserLeaves: true,
                Going: []));
        Assert.Equal([new PublicListEntry(Nickname: null, Regular: false)], summary.Going.ToArray());
    }

    [Fact]
    public void FullRound_IsFull_AndCountsTheLine()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: Capacity + 1);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, NoNames);

        Assert.Equal((PublicRoundState.Full, Capacity, 1), (summary.State, summary.GoingCount, summary.WaitlistCount));
    }

    [Fact]
    public void NoLimit_HasNoCapacity_AndIsNeverFull()
    {
        var unlimited = LimitedWithWaitlist with { CapacityLimited = false };
        var round = Going(RoundFixture.NewRound(), unlimited, count: Capacity + 1);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(unlimited), RoundFixture.Now, NoNames);

        Assert.Equal((PublicRoundState.Open, (int?)null, Capacity + 1), (summary.State, summary.Capacity, summary.GoingCount));
    }

    [Fact]
    public void NoScoreAndNoQueue_HasNoPoints_AndNobodyLeaves()
    {
        var summary = StorePublicRoundSummary.ToSummary(
            RoundFixture.NewRound(), GroupName, Settings(LimitedWithWaitlist, new FormatRules(false, PointsPerSet, false)), RoundFixture.Now, NoNames);

        Assert.Equal(((int?)null, false), (summary.PointsPerSet, summary.LoserLeaves));
    }

    [Fact]
    public void CanceledRound_IsCanceled_EvenFull()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: Capacity).Cancel().Round;

        Assert.Equal(PublicRoundState.Canceled, StateOf(round, RoundFixture.Now));
        Assert.Equal(PublicRoundState.Canceled, StateOf(round, round.Slot.StartsAt));
    }

    [Fact]
    public void StartedRound_IsStarted_FromItsVeryInstant()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: Capacity);
        var startsAt = round.Slot.StartsAt;

        Assert.Equal(PublicRoundState.Full, StateOf(round, startsAt.AddTicks(-1)));
        Assert.Equal(PublicRoundState.Started, StateOf(round, startsAt));
        Assert.Equal(PublicRoundState.Started, StateOf(round, startsAt.AddHours(1)));
    }

    [Fact]
    public async Task GroupThatDoesNotExist_GivesNoSummary()
    {
        var summaries = new StorePublicRoundSummary(
            new RoundLinkReader(new OneRoundStore(RoundFixture.NewRound())), new NoGroups(), new NoSettings(), new NoListNames(), TimeProvider.System);

        Assert.Null(await summaries.FindByCodeAsync(AnyCode, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task CodeOfNoRound_GivesNoSummary()
    {
        var summaries = new StorePublicRoundSummary(
            new RoundLinkReader(new OneRoundStore(null)), new NoGroups(), new NoSettings(), new NoListNames(), TimeProvider.System);

        Assert.Null(await summaries.FindByCodeAsync(AnyCode, TestContext.Current.CancellationToken));
    }

    [Fact]
    public void Going_IsTheLineByArrival_WithTheNamesAndTheMensalistaMark_AndALeaverWithoutAName()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: Capacity + 1);
        var names = new Dictionary<Guid, ListName>
        {
            [RoundFixture.Member(1).Value] = new("Ana", Regular: true),
            [RoundFixture.Member(2).Value] = new("Rafa", Regular: false),
            [RoundFixture.Member(3).Value] = new("Espera", Regular: false),
        };

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, names);

        Assert.Equal([new PublicListEntry("Ana", true), new PublicListEntry("Rafa", false)], summary.Going.ToArray());
    }

    [Fact]
    public void MemberWhoLeft_IsALineWithoutAName()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, NoNames);

        Assert.Equal([new PublicListEntry(Nickname: null, Regular: false)], summary.Going.ToArray());
    }

    /// <summary>
    /// A closed list: a new field is a decision about what the anonymous page shows, never a side effect. The first names
    /// (<see cref="PublicRoundSummary.Going"/>) are there by the decision of 19/11/2026 (question 126, option 2: the first
    /// names for everyone, as on screen 01); still no id, position, level or money.
    /// </summary>
    [Fact]
    public void Summary_HasOnlyThePublicFields_AndNoneOfAMember()
    {
        string[] expected =
        [
            "GroupName", "LocalDate", "LocalTime", "TimeZone", "StartsAt", "Venue", "State", "Capacity", "GoingCount",
            "WaitlistCount", "WaitlistEnabled", "PlayersPerTeam", "PointsPerSet", "LoserLeaves", "Going",
        ];

        Assert.Equal(expected.Order(StringComparer.Ordinal), PropertiesOf(typeof(PublicRoundSummary)));
        Assert.Equal(["Nickname", "Regular"], PropertiesOf(typeof(PublicListEntry)));
        Assert.DoesNotContain(
            typeof(PublicRoundSummary).GetProperties().Concat(typeof(PublicListEntry).GetProperties()),
            property => property.PropertyType == typeof(Guid) || property.PropertyType == typeof(Guid?));
    }

    private static IEnumerable<string> PropertiesOf(Type type) =>
        type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(property => property.Name != "EqualityContract")
            .Select(property => property.Name)
            .Order(StringComparer.Ordinal);

    private static PublicRoundState StateOf(Round round, DateTimeOffset now) =>
        StorePublicRoundSummary.StateOf(round, RoundGroupState.ToDomain(LimitedWithWaitlist), now);

    private static Round Going(Round round, AttendanceRules rules, int count) =>
        RoundFixture.Going(round, RoundGroupState.ToDomain(rules), count);

    private static RoundSettings Settings(AttendanceRules attendance, FormatRules? format = null) => new(
        LayerJson: null,
        ResolvedJson: "{}",
        ImmutableDictionary<string, string>.Empty,
        attendance,
        new DrawRules(Enabled: false, BalanceByLevel: false, IndoorPlayers),
        format ?? new FormatRules(ScoringEnabled: true, PointsPerSet, QueueEnabled: true));

    private sealed class OneRoundStore(Round? round) : UnsupportedRoundStore
    {
        public override Task<Round?> FindByLinkCodeAsync(RoundLinkCode code, CancellationToken cancellationToken) => Task.FromResult(round);
    }

    private sealed class NoGroups : IGroupDirectory
    {
        public Task<string?> FindNameAsync(Guid groupId, CancellationToken cancellationToken) => Task.FromResult<string?>(null);
    }

    private sealed class NoListNames : IRoundListNames
    {
        public Task<IReadOnlyDictionary<Guid, ListName>> FindAsync(
            Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken) =>
            Task.FromResult(NoNames);
    }

    private sealed class NoSettings : IGroupSettingsReader
    {
        public Task<GroupSettingsSnapshot?> GetAsync(Guid groupId, CancellationToken cancellationToken) =>
            Task.FromResult<GroupSettingsSnapshot?>(null);

        public Result<RoundSettings> ResolveRound(GroupSettingsSnapshot group, string? roundLayerJson) => throw new NotSupportedException();
    }
}
