using System.Globalization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;

namespace Sacou.Http.AppConfig;

/// <summary>
/// The minimum native build (ADR 0084): an app that names its platform and build in two headers and is below the
/// minimum gets 426 <c>api.app-outdated</c> on every <c>/v1</c> route but the app config, before the authentication. The
/// headers are trusted for nothing else: a missing, repeated, long or odd one passes (a browser, a test, an old build).
/// </summary>
public static class AppBuildGate
{
    public const string BuildHeader = "X-Sacou-App-Build";
    public const string PlatformHeader = "X-Sacou-App-Platform";
    public const string AppConfigRoute = "/v1/app-config";

    private const string GuardedPrefix = "/v1";
    private const int MaxHeaderLength = 16;
    private const int UpgradeRequired = 426;
    private const string Title = "Upgrade required";
    private const string Type = "https://tools.ietf.org/html/rfc9110#section-15.5.22";

    public static IApplicationBuilder UseSacouAppBuildGate(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.Use(async (context, next) =>
        {
            if (IsGuarded(context.Request.Path) && IsBelowMinimum(context))
            {
                var problem = TypedResults.Problem(
                    statusCode: UpgradeRequired,
                    title: Title,
                    type: Type,
                    extensions: new Dictionary<string, object?> { [ProblemResults.CodeExtension] = AppConfigErrors.AppOutdatedCode });
                await problem.ExecuteAsync(context).ConfigureAwait(false);
                return;
            }

            await next(context).ConfigureAwait(false);
        });
    }

    private static bool IsGuarded(PathString path) =>
        path.StartsWithSegments(GuardedPrefix) && !path.StartsWithSegments(AppConfigRoute);

    private static bool IsBelowMinimum(HttpContext context)
    {
        var headers = context.Request.Headers;
        if (!TryReadSingle(headers[PlatformHeader], out var platform) || !TryReadSingle(headers[BuildHeader], out var buildText)
            || !int.TryParse(buildText, NumberStyles.None, CultureInfo.InvariantCulture, out var build))
        {
            return false;
        }

        var options = context.RequestServices.GetRequiredService<IOptions<AppConfigOptions>>().Value;
        var minimum = options.MinimumBuild.Of(platform.ToLowerInvariant());
        return minimum is { } floor && build < floor;
    }

    /// <summary>One short value only: a header sent twice, empty or longer than any real value is no information.</summary>
    private static bool TryReadSingle(StringValues values, out string value)
    {
        value = values.Count == 1 ? values[0] ?? string.Empty : string.Empty;
        return value.Length is > 0 and <= MaxHeaderLength;
    }
}
