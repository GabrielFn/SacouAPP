namespace Sacou.Api.Observability;

/// <summary>
/// R1 of ADR 0080: Cloud Run freezes the CPU once a request is over, so a failed request (500 and up) waits for its
/// Sentry event to leave before it completes, within <see cref="ObservabilitySetup.FlushTimeout"/>. The SDK's own
/// flush before completion is not public in this version. Registered before <c>UseSentry</c>, so this middleware wraps
/// the SDK's one, which captures the exception only on its way out.
/// </summary>
internal sealed class FlushOnFailureStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        var hub = app.ApplicationServices.GetRequiredService<IHub>();
        app.Use(async (context, nextMiddleware) =>
        {
            await nextMiddleware(context);
            if (context.Response.StatusCode >= StatusCodes.Status500InternalServerError)
            {
                await hub.FlushAsync(ObservabilitySetup.FlushTimeout);
            }
        });
        next(app);
    };
}
