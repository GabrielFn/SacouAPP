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
    private const bool WithRegular = true;
    private const int SecondsPerDay = 24 * 60 * 60;

    private static readonly IReadOnlyDictionary<Guid, ListName> NoNames = new Dictionary<Guid, ListName>();

    private static readonly AttendanceRules LimitedWithWaitlist = new(
        Enabled: true, CapacityLimited: true, Capacity, WaitlistEnabled: true, RegularsEnabled: false, DropInWindowEnabled: false, DropInOpensHoursBefore: 24);

    [Fact]
    public void OpenRound_WithRoom_IsOpen_AndCarriesTheCountsAndTheFormat()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, NoNames, WithRegular);

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

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, NoNames, WithRegular);

        Assert.Equal((PublicRoundState.Full, Capacity, 1), (summary.State, summary.GoingCount, summary.WaitlistCount));
    }

    [Fact]
    public void NoLimit_HasNoCapacity_AndIsNeverFull()
    {
        var unlimited = LimitedWithWaitlist with { CapacityLimited = false };
        var round = Going(RoundFixture.NewRound(), unlimited, count: Capacity + 1);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(unlimited), RoundFixture.Now, NoNames, WithRegular);

        Assert.Equal((PublicRoundState.Open, (int?)null, Capacity + 1), (summary.State, summary.Capacity, summary.GoingCount));
    }

    [Fact]
    public void DropInWindow_CarriesTheInstantItOpens_AndNullWhenOff()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);
        var withWindow = LimitedWithWaitlist with { RegularsEnabled = true, DropInWindowEnabled = true, DropInOpensHoursBefore = 12 };

        var on = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(withWindow), RoundFixture.Now, NoNames, WithRegular);
        var off = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, NoNames, WithRegular);

        Assert.Equal(round.Slot.StartsAt.AddHours(-12), on.DropInOpensAt);
        Assert.Null(off.DropInOpensAt);
    }

    /// <summary>Without an active mensalista the window does not hold, so the page says nothing of it (ADR 0079, P3).</summary>
    [Fact]
    public void DropInWindow_IsNull_WhileTheGroupHasNoActiveMensalista()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);
        var withWindow = LimitedWithWaitlist with { RegularsEnabled = true, DropInWindowEnabled = true, DropInOpensHoursBefore = 12 };

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(withWindow), RoundFixture.Now, NoNames, hasActiveRegular: false);

        Assert.Null(summary.DropInOpensAt);
        Assert.Equal(PublicRoundState.Open, summary.State);
    }

    [Fact]
    public void NoScoreAndNoQueue_HasNoPoints_AndNobodyLeaves()
    {
        var summary = StorePublicRoundSummary.ToSummary(
            RoundFixture.NewRound(), GroupName, Settings(LimitedWithWaitlist, new FormatRules(false, PointsPerSet, false)), RoundFixture.Now, NoNames, WithRegular);

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
            new RoundLinkReader(new OneRoundStore(RoundFixture.NewRound())), new NoGroups(), new NoSettings(), new NoListNames(), new NoMembers(), TimeProvider.System);

        Assert.Null(await summaries.FindByCodeAsync(AnyCode, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task CodeOfNoRound_GivesNoSummary()
    {
        var summaries = new StorePublicRoundSummary(
            new RoundLinkReader(new OneRoundStore(null)), new NoGroups(), new NoSettings(), new NoListNames(), new NoMembers(), TimeProvider.System);

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

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, names, WithRegular);

        Assert.Equal([new PublicListEntry("Ana", true), new PublicListEntry("Rafa", false)], summary.Going.ToArray());
    }

    [Fact]
    public void MemberWhoLeft_IsALineWithoutAName()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), RoundFixture.Now, NoNames, WithRegular);

        Assert.Equal([new PublicListEntry(Nickname: null, Regular: false)], summary.Going.ToArray());
    }

    /// <summary>E6.7, criterion 1: up to 7 days less a second after the start, the names are on the summary.</summary>
    [Theory]
    [InlineData(6 * SecondsPerDay)]
    [InlineData((7 * SecondsPerDay) - 1)]
    public void BeforeTheRetention_TheNamesStay(int secondsAfterStart)
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);
        var now = round.Slot.StartsAt.AddSeconds(secondsAfterStart);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), now, AnaGoing(), WithRegular);

        Assert.False(summary.ListExpired);
        Assert.Equal([new PublicListEntry("Ana", true)], summary.Going.ToArray());
    }

    /// <summary>E6.7, criteria 2 and 4: from 7 days after the start on, no name, even when one was handed in.</summary>
    [Theory]
    [InlineData(7 * SecondsPerDay)]
    [InlineData(8 * SecondsPerDay)]
    public void FromTheRetention_TheListIsEmpty_AndMarkedExpired(int secondsAfterStart)
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);
        var now = round.Slot.StartsAt.AddSeconds(secondsAfterStart);

        var summary = StorePublicRoundSummary.ToSummary(round, GroupName, Settings(LimitedWithWaitlist), now, AnaGoing(), WithRegular);

        Assert.True(summary.ListExpired);
        Assert.Empty(summary.Going);
        Assert.Equal(PublicRoundState.Started, summary.State);
    }

    /// <summary>E6.7, criterion 2: a canceled round and one that ended expire alike, by the start and not the close.</summary>
    [Fact]
    public void CanceledAndEnded_EightDaysAfter_AreExpired()
    {
        var going = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);
        var now = going.Slot.StartsAt.AddDays(8);
        var canceled = going.Cancel().Round;
        var ended = going.Close(now.AddDays(-1), hasFinishedMatch: true).Value.Round;

        var ofCanceled = StorePublicRoundSummary.ToSummary(canceled, GroupName, Settings(LimitedWithWaitlist), now, AnaGoing(), WithRegular);
        var ofEnded = StorePublicRoundSummary.ToSummary(ended, GroupName, Settings(LimitedWithWaitlist), now, AnaGoing(), WithRegular);

        Assert.Equal((PublicRoundState.Canceled, true), (ofCanceled.State, ofCanceled.ListExpired));
        Assert.Equal((PublicRoundState.Ended, true), (ofEnded.State, ofEnded.ListExpired));
        Assert.Empty(ofCanceled.Going);
        Assert.Empty(ofEnded.Going);
    }

    /// <summary>E6.7, criterion 4: after the retention the names are not even read; before it, read once.</summary>
    [Fact]
    public async Task NamesOnPage_AreNotRead_FromTheRetentionOn()
    {
        var round = Going(RoundFixture.NewRound(), LimitedWithWaitlist, count: 1);
        var expired = new CountingListNames();
        var listed = new CountingListNames();
        var cancellation = TestContext.Current.CancellationToken;

        var none = await StorePublicRoundSummary.NamesOnPageAsync(expired, round, round.Slot.StartsAt.AddDays(7), cancellation);
        var some = await StorePublicRoundSummary.NamesOnPageAsync(listed, round, round.Slot.StartsAt.AddDays(6), cancellation);

        Assert.Equal(0, expired.Calls);
        Assert.Empty(none);
        Assert.Equal(1, listed.Calls);
        Assert.NotEmpty(some);
    }

    /// <summary>
    /// A closed list: a new field is a decision about what the anonymous page shows, never a side effect. The first names
    /// (<see cref="PublicRoundSummary.Going"/>) are there by the decision of 19/11/2026 (question 126, option 2: the first
    /// names for everyone, as on screen 01); still no id, position, level or money. <see cref="PublicRoundSummary.DropInOpensAt"/>
    /// came with R101 (ADR 0079): a rule of the group (the instant the avulsos' list opens), not data of a member.
    /// <see cref="PublicRoundSummary.ListExpired"/> came with E6.7: the mark that the names left the page 7 days after
    /// the start, not data of a member either.
    /// </summary>
    [Fact]
    public void Summary_HasOnlyThePublicFields_AndNoneOfAMember()
    {
        string[] expected =
        [
            "GroupName", "LocalDate", "LocalTime", "TimeZone", "StartsAt", "Venue", "State", "Capacity", "GoingCount",
            "WaitlistCount", "WaitlistEnabled", "PlayersPerTeam", "PointsPerSet", "LoserLeaves", "Going", "DropInOpensAt",
            "ListExpired",
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
        format ?? new FormatRules(ScoringEnabled: true, PointsPerSet, QueueEnabled: true),
        new SummaryRules(GameModality.Indoor6x6, MvpEnabled: false, MvpByStats: true, IndividualPoints: false));

    private static Dictionary<Guid, ListName> AnaGoing() => new() { [RoundFixture.Member(1).Value] = new("Ana", Regular: true) };

    /// <summary>Counts the reads, so a test sees that none happened after the retention.</summary>
    private sealed class CountingListNames : IRoundListNames
    {
        public int Calls { get; private set; }

        public Task<IReadOnlyDictionary<Guid, ListName>> FindAsync(
            Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult<IReadOnlyDictionary<Guid, ListName>>(AnaGoing());
        }
    }

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

    /// <summary>Never reached: these summaries stop before the members are read.</summary>
    private sealed class NoMembers : IGroupMembership
    {
        public Task<GroupMembership?> FindActiveAsync(Guid groupId, Guid userId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<GroupMembership>> ListActiveAsync(Guid groupId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<Guid>> ListMemberIdsOfUserAsync(Guid userId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlySet<Guid>> FindMembersOfGroupAsync(
            Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken) => throw new NotSupportedException();

        public bool Allows(GroupRole role, GroupCapability capability) => throw new NotSupportedException();
    }
}
