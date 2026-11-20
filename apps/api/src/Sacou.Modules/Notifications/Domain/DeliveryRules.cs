using System.Collections.Immutable;
using Sacou.Shared.Results;

namespace Sacou.Modules.Notifications.Domain;

/// <summary>
/// The moves of a delivery, as a pure table (ADR 0069, D5; case U2 of E3.11). A final state never moves, and a delivery
/// the service took (<see cref="DeliveryState.Sent"/>) never goes back to the line: a second send could be a duplicate.
/// </summary>
internal static class DeliveryRules
{
    /// <summary>Tries in all, the first one included. After the last one a retryable answer is a failure.</summary>
    public const int MaxAttempts = 5;

    /// <summary>Never reaches HTTP: a refused move is a defect of the pump, logged by its code.</summary>
    public static readonly Error MoveRefused = new("notifications.delivery-move-refused", ErrorKind.Conflict);

    /// <summary>How long a delivery waits after its n-th try failed with a retryable answer: 30 s, 2 min, 10 min, 30 min.</summary>
    public static readonly ImmutableArray<TimeSpan> RetryDelays =
        [TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(10), TimeSpan.FromMinutes(30)];

    private static readonly ImmutableDictionary<DeliveryState, ImmutableHashSet<DeliveryState>> Moves =
        ImmutableDictionary<DeliveryState, ImmutableHashSet<DeliveryState>>.Empty
            .Add(DeliveryState.Pending, [DeliveryState.Sending, DeliveryState.Expired])
            .Add(DeliveryState.Sending, [DeliveryState.Pending, DeliveryState.Sent, DeliveryState.Failed, DeliveryState.Unknown])
            .Add(DeliveryState.Sent, [DeliveryState.Delivered, DeliveryState.Failed, DeliveryState.Unknown]);

    public static bool IsFinal(DeliveryState state) => !Moves.ContainsKey(state);

    public static Result<DeliveryState> Move(DeliveryState from, DeliveryState to) =>
        Moves.TryGetValue(from, out var allowed) && allowed.Contains(to) ? Result.Success(to) : Result.Failure<DeliveryState>(MoveRefused);

    /// <summary>
    /// Where a retryable answer leaves a delivery after <paramref name="attempts"/> tries: back in line after its delay,
    /// or failed once the tries are spent.
    /// </summary>
    public static (DeliveryState State, TimeSpan Delay) AfterRetryable(int attempts) =>
        attempts >= MaxAttempts
            ? (DeliveryState.Failed, TimeSpan.Zero)
            : (DeliveryState.Pending, RetryDelays[Math.Clamp(attempts, 1, RetryDelays.Length) - 1]);
}
