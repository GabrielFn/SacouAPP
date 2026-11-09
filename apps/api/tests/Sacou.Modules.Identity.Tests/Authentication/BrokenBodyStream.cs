namespace Sacou.Modules.Identity.Tests.Authentication;

/// <summary>A response body that never ends, or that fails in the middle like a reset connection.</summary>
internal sealed class BrokenBodyStream(Exception? failure = null) : Stream
{
    public override bool CanRead => true;

    public override bool CanSeek => false;

    public override bool CanWrite => false;

    public override long Length => throw new NotSupportedException();

    public override long Position
    {
        get => 0;
        set => throw new NotSupportedException();
    }

    public override void Flush()
    {
    }

    public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

    public override void SetLength(long value) => throw new NotSupportedException();

    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        if (failure is not null)
        {
            throw failure;
        }

        await Task.Delay(Timeout.Infinite, cancellationToken);
        return 0;
    }
}
