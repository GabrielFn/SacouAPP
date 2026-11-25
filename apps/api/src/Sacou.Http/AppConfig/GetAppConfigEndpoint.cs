using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Sacou.Http.AppConfig;

/// <summary>One number per platform.</summary>
public sealed record PlatformBuilds(int Android, int Ios);

/// <summary>One store page per platform; <c>null</c> when there is none.</summary>
public sealed record PlatformUrls(string? Android, string? Ios);

/// <summary>The flags of this environment. One property per flag of <see cref="AppFeature"/>: a closed list, never a free map.</summary>
public sealed record FeatureSwitchesResponse(bool MvpVote);

/// <summary>What the app asks before anything else: the minimum build, where to update and the flags. No person's data.</summary>
public sealed record AppConfigResponse(PlatformBuilds MinimumBuild, PlatformUrls UpdateUrl, FeatureSwitchesResponse Features);

/// <summary>
/// <c>GET /v1/app-config</c> (ADR 0084): anonymous, because the app asks before the sign-in, and it never reads the
/// database. Cacheable for a short while by the proxies; limited per client address (<c>app-config</c>).
/// </summary>
public static class GetAppConfigEndpoint
{
    public const string Name = "GetAppConfig";
    public const string CacheControl = "public, max-age=60";

    public static RouteHandlerBuilder MapAppConfig(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        return endpoints.MapGet(AppBuildGate.AppConfigRoute, Handle).WithName(Name);
    }

    private static Ok<AppConfigResponse> Handle(IOptions<AppConfigOptions> options, HttpContext context)
    {
        var config = options.Value;
        context.Response.Headers[HeaderNames.CacheControl] = CacheControl;
        return TypedResults.Ok(new AppConfigResponse(
            new PlatformBuilds(config.MinimumBuild.Android, config.MinimumBuild.Ios),
            new PlatformUrls(NullIfEmpty(config.UpdateUrl.Android), NullIfEmpty(config.UpdateUrl.Ios)),
            new FeatureSwitchesResponse(config.IsOn(AppFeature.MvpVote))));
    }

    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;
}
