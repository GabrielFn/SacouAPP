using Microsoft.AspNetCore.Http;
using Sacou.Modules.Matches.AppendCourtEvents;
using Xunit;

namespace Sacou.Modules.Matches.Tests.AppendCourtEvents;

/// <summary>D8 step 1 without Kestrel: the buffer never passes the ceiling, with or without a declared length.</summary>
public sealed class BoundedBodyTests
{
    private const int Ceiling = 1_000;

    [Theory]
    [InlineData(0, true)]
    [InlineData(1, true)]
    [InlineData(Ceiling, true)]
    [InlineData(Ceiling + 1, false)]
    [InlineData(Ceiling * 50, false)]
    public async Task ReadsUpToTheCeiling_WithoutALength(int size, bool read)
    {
        var body = await ReadAsync(size, declareLength: false);

        Assert.Equal(read, body is not null);
        if (read)
        {
            Assert.Equal(size, body!.Value.Length);
        }
    }

    [Theory]
    [InlineData(Ceiling, true)]
    [InlineData(Ceiling + 1, false)]
    public async Task ADeclaredLength_AboveTheCeiling_IsRefusedBeforeReading(int size, bool read)
    {
        Assert.Equal(read, await ReadAsync(size, declareLength: true) is not null);
    }

    [Fact]
    public async Task TheBytes_AreTheBody()
    {
        byte[] bytes = [.. Enumerable.Range(0, Ceiling).Select(index => (byte)index)];
        var context = new DefaultHttpContext();
        context.Request.Body = new MemoryStream(bytes);

        var body = await BoundedBody.ReadAsync(context.Request, Ceiling, TestContext.Current.CancellationToken);

        Assert.Equal(bytes, body!.Value.ToArray());
    }

    private static async Task<ReadOnlyMemory<byte>?> ReadAsync(int size, bool declareLength)
    {
        var context = new DefaultHttpContext();
        context.Request.Body = new MemoryStream(new byte[size]);
        if (declareLength)
        {
            context.Request.ContentLength = size;
        }

        return await BoundedBody.ReadAsync(context.Request, Ceiling, TestContext.Current.CancellationToken);
    }
}
