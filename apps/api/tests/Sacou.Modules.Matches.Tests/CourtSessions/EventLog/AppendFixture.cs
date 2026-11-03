using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

namespace Sacou.Modules.Matches.Tests.CourtSessions.EventLog;

/// <summary>Port of <c>append-fixture.test.fixture.ts</c>. Appending is not commutative, so it reveals order mistakes.</summary>
internal sealed record FixtureState(ImmutableArray<RawValue> Values)
{
    public static readonly FixtureState Empty = new([]);
}

internal static class AppendFixture
{
    public const string FixtureAppended = "FixtureAppended";
    public const string FixtureRejected = "FixtureRejected";
    public const string ValueField = "value";

    public static readonly ImmutableDictionary<string, Func<FixtureState, EventEnvelope, Result<FixtureState, EventRejection>>> Appliers =
        ImmutableDictionary.CreateRange(
            StringComparer.Ordinal,
            [
                KeyValuePair.Create<string, Func<FixtureState, EventEnvelope, Result<FixtureState, EventRejection>>>(FixtureAppended, AppendValue),
                KeyValuePair.Create<string, Func<FixtureState, EventEnvelope, Result<FixtureState, EventRejection>>>(FixtureRejected, (_, _) => Rejected()),
            ]);

    public static ReplayConfig<FixtureState> Config(string courtSessionId, FixtureState? initialState = null) =>
        new(courtSessionId, initialState ?? FixtureState.Empty, Appliers);

    private static Result<FixtureState, EventRejection> AppendValue(FixtureState state, EventEnvelope envelope) =>
        envelope.Payload.TryGetMember(ValueField, out var value)
            ? Result<FixtureState, EventRejection>.Success(new FixtureState(state.Values.Add(value)))
            : Rejected();

    /// <summary>The values as JSON text: two replays build equal states, never the same instance.</summary>
    public static string Text(FixtureState state) => EnvelopeParserTests.Write(new RawArray(state.Values));

    private static Result<FixtureState, EventRejection> Rejected() =>
        Result<FixtureState, EventRejection>.Failure(EventRejection.Instance);
}
