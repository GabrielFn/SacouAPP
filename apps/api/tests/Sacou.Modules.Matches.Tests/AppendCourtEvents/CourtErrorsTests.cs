using Sacou.Modules.Matches.AppendCourtEvents;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Modules.Matches.Tests.AppendCourtEvents;

/// <summary>The answers of ADR 0060, D1 and D15, written by hand from the contract table of the plan (section 3).</summary>
public sealed class CourtErrorsTests
{
    public static readonly TheoryData<string, ErrorKind> WriteCodes = new()
    {
        { "batch-invalid", ErrorKind.Validation },
        { "stream-mismatch", ErrorKind.Validation },
        { "unsupported-schema-version", ErrorKind.Validation },
        { "unknown-event-type", ErrorKind.Validation },
        { "not-the-writer", ErrorKind.Conflict },
        { "batch-mismatch", ErrorKind.Conflict },
        { "event-id-conflict", ErrorKind.Conflict },
        { "sequence-gap", ErrorKind.Conflict },
        { "sequence-conflict", ErrorKind.Conflict },
        { "limit-reached", ErrorKind.Unprocessable },
        { "event-rejected", ErrorKind.Unprocessable },
        { "event-implausible", ErrorKind.Unprocessable },
        { "member-not-in-group", ErrorKind.Unprocessable },
    };

    [Theory]
    [MemberData(nameof(WriteCodes))]
    public void EachWriteCode_HasItsAnswer(string code, ErrorKind kind)
    {
        var error = CourtErrors.Of(CourtWriteErrorCode.All.Single(candidate => candidate.Code == code));

        Assert.Equal("matches." + code, error.Code);
        Assert.Equal(kind, error.Kind);
    }

    [Fact]
    public void EveryCodeOfTheDomain_IsInTheTableAbove()
    {
        Assert.Equal(WriteCodes.Select(row => row.Data.Item1).Order(StringComparer.Ordinal), CourtWriteErrorCode.All.Select(code => code.Code).Order(StringComparer.Ordinal));
    }

    [Theory]
    [InlineData(EventBatchError.BatchInvalidCode)]
    [InlineData(EventBatchError.EventTooLargeCode)]
    [InlineData(EventBatchError.InvalidEnvelopeCode)]
    public void EachReaderCode_IsAValidationError(string code)
    {
        var error = CourtErrors.Of(new EventBatchError(code));

        Assert.Equal("matches." + code, error.Code);
        Assert.Equal(ErrorKind.Validation, error.Kind);
    }

    [Theory]
    [InlineData(nameof(CourtStreamRefusal.CourtSessionNotFound), "matches.court-session-not-found", ErrorKind.NotFound)]
    [InlineData(nameof(CourtStreamRefusal.RoundHasCourtSession), "matches.round-has-court-session", ErrorKind.Conflict)]
    [InlineData(nameof(CourtStreamRefusal.RoundCanceled), "matches.round-canceled", ErrorKind.Conflict)]
    public void EachStreamRefusal_HasItsAnswer(string refusal, string code, ErrorKind kind)
    {
        Assert.Equal(new Error(code, kind), CourtErrors.Of(Enum.Parse<CourtStreamRefusal>(refusal)));
    }

    /// <summary>Only the details the error carries, by the keys of D15; never a member id.</summary>
    [Fact]
    public void AProblem_CarriesOnlyItsDetails()
    {
        const string EventId = "e0000000-0000-4000-8000-000000000001";

        var gap = CourtProblems.From(new CourtWriteError(CourtWriteErrorCode.SequenceGap, EventId, ExpectedSequence: 4));
        var field = CourtProblems.From(new EventBatchError(EventBatchError.InvalidEnvelopeCode, "payload", 2));
        var member = CourtProblems.From(new CourtWriteError(CourtWriteErrorCode.MemberNotInGroup, EventId));

        Assert.Equal(["eventId", "expectedSequence"], gap.Extensions.Keys.Order(StringComparer.Ordinal));
        Assert.Equal(4L, gap.Extensions["expectedSequence"]);
        Assert.Equal(["field", "index"], field.Extensions.Keys.Order(StringComparer.Ordinal));
        Assert.Equal(["eventId"], member.Extensions.Keys);
    }
}
