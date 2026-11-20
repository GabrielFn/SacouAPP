using Sacou.Modules.Notifications.Domain;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>U2 of E3.11: every move of a delivery, allowed or refused, by the table.</summary>
public sealed class DeliveryRulesTests
{
    public static readonly TheoryData<string, string> Allowed = new()
    {
        { nameof(DeliveryState.Pending), nameof(DeliveryState.Sending) },
        { nameof(DeliveryState.Pending), nameof(DeliveryState.Expired) },
        { nameof(DeliveryState.Sending), nameof(DeliveryState.Pending) },
        { nameof(DeliveryState.Sending), nameof(DeliveryState.Sent) },
        { nameof(DeliveryState.Sending), nameof(DeliveryState.Failed) },
        { nameof(DeliveryState.Sending), nameof(DeliveryState.Unknown) },
        { nameof(DeliveryState.Sent), nameof(DeliveryState.Delivered) },
        { nameof(DeliveryState.Sent), nameof(DeliveryState.Failed) },
        { nameof(DeliveryState.Sent), nameof(DeliveryState.Unknown) },
    };

    [Fact]
    public void EveryPairOutsideTheTable_IsRefused()
    {
        var allowed = Allowed.Select(row => (State(row.Data.Item1), State(row.Data.Item2))).ToHashSet();
        foreach (var from in Enum.GetValues<DeliveryState>())
        {
            foreach (var to in Enum.GetValues<DeliveryState>())
            {
                var moved = DeliveryRules.Move(from, to);
                Assert.Equal(allowed.Contains((from, to)), moved.IsSuccess);
                if (moved.IsFailure)
                {
                    Assert.Equal(DeliveryRules.MoveRefused, moved.Error);
                }
            }
        }
    }

    [Theory]
    [MemberData(nameof(Allowed))]
    public void ListedMove_IsAllowed(string from, string to) => Assert.Equal(State(to), DeliveryRules.Move(State(from), State(to)).Value);

    [Theory]
    [InlineData(nameof(DeliveryState.Sent), nameof(DeliveryState.Pending))]
    [InlineData(nameof(DeliveryState.Sent), nameof(DeliveryState.Sending))]
    [InlineData(nameof(DeliveryState.Failed), nameof(DeliveryState.Pending))]
    [InlineData(nameof(DeliveryState.Failed), nameof(DeliveryState.Sent))]
    [InlineData(nameof(DeliveryState.Unknown), nameof(DeliveryState.Pending))]
    [InlineData(nameof(DeliveryState.Expired), nameof(DeliveryState.Sending))]
    [InlineData(nameof(DeliveryState.Pending), nameof(DeliveryState.Sent))]
    public void NamedRefusals_AreRefused(string from, string to) => Assert.True(DeliveryRules.Move(State(from), State(to)).IsFailure);

    [Theory]
    [InlineData(nameof(DeliveryState.Delivered))]
    [InlineData(nameof(DeliveryState.Failed))]
    [InlineData(nameof(DeliveryState.Unknown))]
    [InlineData(nameof(DeliveryState.Expired))]
    public void FinalStates_AreFinal(string state) => Assert.True(DeliveryRules.IsFinal(State(state)));

    [Theory]
    [InlineData(nameof(DeliveryState.Pending))]
    [InlineData(nameof(DeliveryState.Sending))]
    [InlineData(nameof(DeliveryState.Sent))]
    public void OpenStates_AreNotFinal(string state) => Assert.False(DeliveryRules.IsFinal(State(state)));

    [Theory]
    [InlineData(1, 30)]
    [InlineData(2, 120)]
    [InlineData(3, 600)]
    [InlineData(4, 1800)]
    public void Retryable_WaitsByTheTable(int attempts, int seconds)
    {
        var (state, delay) = DeliveryRules.AfterRetryable(attempts);

        Assert.Equal(DeliveryState.Pending, state);
        Assert.Equal(TimeSpan.FromSeconds(seconds), delay);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(6)]
    public void Retryable_AfterTheLastTry_Fails(int attempts) => Assert.Equal(DeliveryState.Failed, DeliveryRules.AfterRetryable(attempts).State);

    private static DeliveryState State(string name) => Enum.Parse<DeliveryState>(name);
}
