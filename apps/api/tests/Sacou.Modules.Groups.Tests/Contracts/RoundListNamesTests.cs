using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Tests.Access;
using Sacou.Modules.Identity.Contracts;
using Xunit;
using DomainMemberType = Sacou.Modules.Groups.Domain.Members.MemberType;

namespace Sacou.Modules.Groups.Tests.Contracts;

/// <summary>
/// The names of a round's public list (question 126, option 2): the nickname of the profile or the guest's first name, the
/// mensalista mark, only for the asked members who are active; never a position or a level.
/// </summary>
public sealed class RoundListNamesTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 19, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid Group = Guid.Parse("00000000-0000-0000-0000-0000000000a1");

    [Fact]
    public async Task Names_AreTheNicknameOrTheGuestName_WithTheMensalistaMark()
    {
        var regular = GroupMember.Joining(new UserId(Guid.NewGuid()), Now) with { Type = DomainMemberType.Regular };
        var withoutProfile = GroupMember.Joining(new UserId(Guid.NewGuid()), Now);
        var guest = GroupMember.Guest(Now);
        var notAsked = GroupMember.Joining(new UserId(Guid.NewGuid()), Now);
        var store = new FakeGroupStore
        {
            Roster =
            [
                new RosterEntry(regular, Guest: null),
                new RosterEntry(withoutProfile, Guest: null),
                new RosterEntry(guest, new GuestProfile(GuestName.Create("Tio Zé").Value, Position: null)),
                new RosterEntry(notAsked, Guest: null),
            ],
        };
        var profiles = new Profiles(new PlayerProfileView(regular.UserId!.Value.Value, "Ana", PrimaryPosition.Setter, [], SuggestedLevelTenths: 70));
        var stranger = Guid.NewGuid();

        var names = await new StoreRoundListNames(store, profiles).FindAsync(
            Group, [regular.Id.Value, withoutProfile.Id.Value, guest.Id.Value, stranger], TestContext.Current.CancellationToken);

        Assert.Equal(new ListName("Ana", Regular: true), names[regular.Id.Value]);
        Assert.Equal(new ListName(null, Regular: false), names[withoutProfile.Id.Value]);
        Assert.Equal(new ListName("Tio", Regular: false), names[guest.Id.Value]);
        Assert.False(names.ContainsKey(stranger));
        Assert.False(names.ContainsKey(notAsked.Id.Value));
    }

    [Theory]
    [InlineData("Maria das Graças Souza", "Maria")]
    [InlineData("   Léo   Lima  ", "Léo")]
    [InlineData("Léo", "Léo")]
    [InlineData("Léo	Lima", "Léo")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    public async Task AGuest_ShowsOnlyTheFirstName(string stored, string? shown)
    {
        var guest = GroupMember.Guest(Now);
        var store = new FakeGroupStore { Roster = [new RosterEntry(guest, new GuestProfile(GuestName.FromStored(stored), Position: null))] };

        var names = await new StoreRoundListNames(store, new Profiles()).FindAsync(Group, [guest.Id.Value], TestContext.Current.CancellationToken);

        Assert.Equal(new ListName(shown, Regular: false), names[guest.Id.Value]);
    }

    [Fact]
    public async Task NobodyAsked_ReadsNothing()
    {
        var names = await new StoreRoundListNames(new FakeGroupStore(), new Profiles()).FindAsync(Group, [], TestContext.Current.CancellationToken);

        Assert.Empty(names);
    }

    private sealed class Profiles(params PlayerProfileView[] views) : IPlayerProfiles
    {
        public Task<IReadOnlyList<PlayerProfileView>> FindManyAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<PlayerProfileView>>([.. views.Where(view => userIds.Contains(view.UserId))]);
    }
}
