using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Notifications.Contracts;

namespace Sacou.Modules.Sessions.Application.Outbox;

/// <summary>
/// What a write that promoted someone runs after its commit and before answering (ADR 0069, D8): the relay, then the push
/// pump, within <see cref="Budget"/> of their own. The request is never failed nor cancelled by them: what does not fit,
/// or fails, stays in the outbox or pending for the next run. Nothing runs outside a request (ADR 0068).
/// </summary>
internal sealed partial class OutboxDrain(SessionsOutboxRelay relay, INotificationPump pump, ILogger<OutboxDrain> logger)
{
    public static readonly TimeSpan Budget = TimeSpan.FromSeconds(3);

    public async Task RunAsync()
    {
        using var budget = new CancellationTokenSource(Budget);
        try
        {
            int relayed;
            do
            {
                relayed = await relay.RunAsync(budget.Token).ConfigureAwait(false);
            }
            while (relayed == SessionsOutboxRelay.BatchSize);

            await pump.RunAsync(budget.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (budget.IsCancellationRequested)
        {
            Stopped(logger, "budget-spent");
        }
        catch (DbException exception)
        {
            Stopped(logger, exception.GetType().Name);
        }
        catch (DbUpdateException exception)
        {
            Stopped(logger, exception.GetType().Name);
        }
    }

    /// <summary>The reason is a code or an exception type, never its message (it may quote a value).</summary>
    [LoggerMessage(Level = LogLevel.Warning, Message = "Outbox drain stopped: {Reason}; the rest waits for the next run.")]
    private static partial void Stopped(ILogger logger, string reason);
}
