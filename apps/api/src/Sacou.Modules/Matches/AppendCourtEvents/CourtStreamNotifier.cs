using Microsoft.Extensions.Logging;
using Sacou.Modules.Matches.Contracts;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>
/// Tells every <see cref="ICourtStreamChanged"/> of a write that changed a finished match, outside the lock and after
/// the commit. A listener that fails is logged with the stream id and the type of the exception only (its message may
/// carry a value of the database); the next one still runs, and the write answers as it did.
/// </summary>
internal sealed class CourtStreamNotifier(IEnumerable<ICourtStreamChanged> listeners, ILogger<CourtStreamNotifier> logger)
{
    public async Task NotifyAsync(Guid groupId, Guid roundId, Guid courtSessionId, CancellationToken cancellationToken)
    {
        foreach (var listener in listeners)
        {
            try
            {
                await listener.CourtStreamChangedAsync(groupId, roundId, courtSessionId, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception exception) when (exception is not OutOfMemoryException)
            {
                CourtLog.ListenerFailed(logger, courtSessionId, exception.GetType().Name);
            }
        }
    }
}
