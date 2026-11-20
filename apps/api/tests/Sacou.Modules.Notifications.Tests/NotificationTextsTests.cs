using Sacou.Modules.Notifications.Application;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>U4 of E3.11: the exact pt-BR texts, from the round's local day and hour.</summary>
public sealed class NotificationTextsTests
{
    private static readonly DateOnly Saturday = new(2026, 11, 21);
    private static readonly DateOnly Thursday = new(2026, 11, 26);
    private static readonly DateOnly Sunday = new(2026, 11, 22);

    [Fact]
    public void PushTitle_IsFixed() => Assert.Equal("Você saiu da espera", NotificationTexts.PushTitle);

    [Theory]
    [MemberData(nameof(PushBodies))]
    public void PushBody_HasGroupDayAndHour(string group, DateOnly date, TimeOnly time, string expected) =>
        Assert.Equal(expected, NotificationTexts.PushBody(group, date, time));

    public static TheoryData<string, DateOnly, TimeOnly, string> PushBodies => new()
    {
        { "Areia", Saturday, new TimeOnly(8, 0), "Entrou no Areia · sáb 8h" },
        { "Vôlei de quinta", Thursday, new TimeOnly(19, 30), "Entrou no Vôlei de quinta · qui 19h30" },
        { "Madrugada", Sunday, new TimeOnly(0, 0), "Entrou no Madrugada · dom 0h" },
        { "Cedo", Sunday, new TimeOnly(7, 5), "Entrou no Cedo · dom 7h05" },
    };

    [Fact]
    public void ListTitle_HasTheLongDay() =>
        Assert.Equal("Você saiu da espera: entrou no Areia de sábado", NotificationTexts.ListTitle("Areia", Saturday));

    [Fact]
    public void ListSubtitle_HasDayHourAndVenue() =>
        Assert.Equal("Sáb 8h · Posto 6", NotificationTexts.ListSubtitle(Saturday, new TimeOnly(8, 0), "Posto 6"));

    [Fact]
    public void ListSubtitle_WithoutVenue_HasDayAndHour() =>
        Assert.Equal("Qui 19h30", NotificationTexts.ListSubtitle(Thursday, new TimeOnly(19, 30), string.Empty));

    [Theory]
    [InlineData(1, "segunda")]
    [InlineData(2, "terça")]
    [InlineData(3, "quarta")]
    [InlineData(4, "quinta")]
    [InlineData(5, "sexta")]
    public void ListTitle_NamesEveryWeekday(int daysAfterSunday, string day) =>
        Assert.EndsWith($"de {day}", NotificationTexts.ListTitle("G", Sunday.AddDays(daysAfterSunday)), StringComparison.Ordinal);

    [Fact]
    public void PushBody_NeverHasTheVenue()
    {
        var body = NotificationTexts.PushBody("Areia", Saturday, new TimeOnly(8, 0));

        Assert.DoesNotContain("Posto", body, StringComparison.Ordinal);
    }
}
