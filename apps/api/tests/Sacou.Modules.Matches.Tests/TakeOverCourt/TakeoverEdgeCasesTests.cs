using System.Collections.Immutable;
using System.Text;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.TakeOverCourt;
using Xunit;

namespace Sacou.Modules.Matches.Tests.TakeOverCourt;

/// <summary>Extra edges of the takeover body and of the decision (ADR 0063, decisions 2, 10 and 14): nothing received is echoed.</summary>
public sealed class TakeoverEdgeCasesTests
{
    private const string Device = "e0000000-0000-4000-8000-000000000001";
    private const string Other = "e0000000-0000-4000-8000-000000000002";
    private const string Caller = "30000000-0000-4000-8000-000000000003";
    private const string OtherCaller = "30000000-0000-4000-8000-000000000004";

    [Theory]
    [InlineData("""{"deviceId":"E0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1}""", "deviceId")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":"1","expectedEventCount":1}""", "expectedBatch")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":-9223372036854775809}""", "expectedEventCount")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1.5}""", "expectedEventCount")]
    [InlineData("""{"deviceId":{"a":1},"expectedBatch":1,"expectedEventCount":1}""", "deviceId")]
    [InlineData("""[{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1}]""", "body")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1} """ + "\0", "body")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,/*x*/"expectedEventCount":1}""", "body")]
    [InlineData("""{"DEVICEID":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1}""", "body")]
    public void EdgeBodies_AreInvalid_AndTheErrorHoldsOnlyTheFieldName(string body, string field)
    {
        var read = TakeoverBodyReader.Read(Encoding.UTF8.GetBytes(body));

        Assert.True(read.IsFailure);
        Assert.Equal(new CourtWriteError(CourtWriteErrorCode.TakeoverInvalid, Field: field), read.Error);
        Assert.DoesNotContain("Secret", read.Error.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void TheLargestLong_IsAccepted_ForBothCounters()
    {
        var read = TakeoverBodyReader.Read(Encoding.UTF8.GetBytes(
            $$"""{"deviceId":"{{Device}}","expectedBatch":9223372036854775807,"expectedEventCount":9223372036854775807}"""));

        Assert.True(read.IsSuccess);
    }

    [Fact]
    public void ABodyWithAReceivedValue_NeverEchoesItInTheError()
    {
        var read = TakeoverBodyReader.Read(Encoding.UTF8.GetBytes("""{"deviceId":"Secret-Value-123","expectedBatch":1,"expectedEventCount":1}"""));

        Assert.True(read.IsFailure);
        Assert.DoesNotContain("Secret", read.Error.Field, StringComparison.Ordinal);
    }

    [Fact]
    public void TheFortyFirstBatch_WithStaleExpectations_IsTheLimit_NotStreamChanged()
    {
        var atLimit = StoredStream.Of(
            ImmutableArray<StreamEvent>.Empty,
            [new CourtWriter(CourtStreamLimits.MaxWritersPerStream, Device, Caller, EventsBefore: 0)]);
        var request = CourtTakeoverRequest.Create(Other, expectedBatch: 1, expectedEventCount: 99).Value;

        var error = CourtTakeover.Decide(atLimit, request, OtherCaller).Error;

        Assert.Equal(CourtWriteErrorCode.LimitReached, error.Code);
        Assert.Equal(StreamLimitNames.WritersPerStream, error.Limit);
    }

    [Fact]
    public void ARefusedTakeover_OpensNoBatch_AndCarriesNoDecision()
    {
        var stream = StoredStream.Of(ImmutableArray<StreamEvent>.Empty, [new CourtWriter(1, Device, Caller, EventsBefore: 0)]);
        var request = CourtTakeoverRequest.Create(Other, expectedBatch: 2, expectedEventCount: 0).Value;

        var result = CourtTakeover.Decide(stream, request, OtherCaller);

        Assert.True(result.IsFailure);
        Assert.Equal(CourtWriteErrorCode.StreamChanged, result.Error.Code);
    }
}
