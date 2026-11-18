using System.Text;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.TakeOverCourt;
using Xunit;

namespace Sacou.Modules.Matches.Tests.TakeOverCourt;

/// <summary>The closed schema of the takeover body (ADR 0063, decision 14): every refusal is <c>takeover-invalid</c> with a field.</summary>
public sealed class TakeoverBodyReaderTests
{
    private const string Device = "e0000000-0000-4000-8000-000000000001";

    [Fact]
    public void AValidBody_IsRead()
    {
        var read = Read($$"""{"deviceId":"{{Device}}","expectedBatch":3,"expectedEventCount":120}""");

        Assert.True(read.IsSuccess);
        Assert.Equal((Device, 3L, 120L), (read.Value.DeviceId, read.Value.ExpectedBatch, read.Value.ExpectedEventCount));
    }

    [Theory]
    [InlineData("""{"deviceId":null,"expectedBatch":1,"expectedEventCount":1}""", "deviceId")]
    [InlineData("""{"deviceId":7,"expectedBatch":1,"expectedEventCount":1}""", "deviceId")]
    [InlineData("""{"expectedBatch":1,"expectedEventCount":1}""", "deviceId")]
    [InlineData("""{"deviceId":"not-a-uuid","expectedBatch":1,"expectedEventCount":1}""", "deviceId")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":9223372036854775808,"expectedEventCount":1}""", "expectedBatch")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1e2,"expectedEventCount":1}""", "expectedBatch")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":null,"expectedEventCount":1}""", "expectedBatch")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":-1}""", "expectedEventCount")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":true}""", "expectedEventCount")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1,"extra":1}""", "body")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedBatch":2,"expectedEventCount":1}""", "body")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1} {}""", "body")]
    [InlineData("""{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1,}""", "body")]
    [InlineData("null", "body")]
    [InlineData("\"text\"", "body")]
    [InlineData("", "body")]
    public void AnInvalidBody_NamesTheField(string body, string field)
    {
        var read = Read(body);

        Assert.True(read.IsFailure);
        Assert.Equal(new CourtWriteError(CourtWriteErrorCode.TakeoverInvalid, Field: field), read.Error);
    }

    private static Result<CourtTakeoverRequest, CourtWriteError> Read(string body) =>
        TakeoverBodyReader.Read(Encoding.UTF8.GetBytes(body));
}
