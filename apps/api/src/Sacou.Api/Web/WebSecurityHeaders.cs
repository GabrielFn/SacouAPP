using Microsoft.Net.Http.Headers;

namespace Sacou.Api.Web;

/// <summary>
/// The headers of the round page and of its files (ADR 0070, D5 and D7), only on those paths: the API routes keep theirs.
/// The page: CSP, no referrer (the path carries the code), no index, no frame, the Google window allowed to answer, never
/// stored (it carries nicknames). The files: no sniffing; the hashed ones cached for a year, the others checked again.
/// The legal pages (E6.1, ADR 0083): the same headers, a closed CSP with no script, and checked again on each visit
/// (public text that changes with each deploy).
/// </summary>
internal sealed class WebSecurityHeaders(RequestDelegate next, ContentSecurityPolicy policy)
{
    public const string PagePrefix = "/r";
    public const string InvitePagePrefix = "/c";
    public const string TermsPrefix = "/termos";
    public const string PrivacyPrefix = "/privacidade";
    public const string AssetsPrefix = "/web";
    public const string BrandPrefix = "/brand";
    public const string HashedAssetsPrefix = "/web/assets/";
    public const string PageCache = "no-store";
    public const string LegalPageCache = "no-cache";

    /// <summary>No script, no connection, no frame: only this host's style, fonts and images.</summary>
    public const string LegalContentSecurityPolicy =
        "default-src 'none'; script-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; "
        + "frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";

    // Only the origin leaves the page: the Firebase Web key is restricted by referrer (ADR 0070, D4), while the path
    // (the round code) and the fragment (the invite token) never go to Google nor to an outside link.
    public const string ReferrerPolicy = "strict-origin";

    public const string UnhashedFileCache = "no-cache, private";
    public const string ImmutableCache = "public, max-age=31536000, immutable";
    public const string BrandCache = "public, max-age=86400";
    public const string PermissionsPolicy = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";

    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var path = context.Request.Path;
        if (path.StartsWithSegments(PagePrefix, StringComparison.Ordinal) || path.StartsWithSegments(InvitePagePrefix, StringComparison.Ordinal))
        {
            context.Response.OnStarting(() => WritePageHeaders(context.Response, policy.Value, PageCache));
        }
        else if (path.StartsWithSegments(TermsPrefix, StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments(PrivacyPrefix, StringComparison.OrdinalIgnoreCase))
        {
            context.Response.OnStarting(() => WritePageHeaders(context.Response, LegalContentSecurityPolicy, LegalPageCache));
        }
        else if (path.StartsWithSegments(AssetsPrefix, StringComparison.Ordinal) || path.StartsWithSegments(BrandPrefix, StringComparison.Ordinal))
        {
            // The manifest is the page's map of the build, read from disk: never served.
            if (path.Equals(AssetsPrefix + "/manifest.json", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return Task.CompletedTask;
            }

            context.Response.OnStarting(() => WriteFileHeaders(context.Response, path));
        }

        return next(context);
    }

    private static Task WritePageHeaders(HttpResponse response, string contentSecurityPolicy, string cache)
    {
        var headers = response.Headers;
        headers[HeaderNames.ContentSecurityPolicy] = contentSecurityPolicy;
        headers[HeaderNames.XContentTypeOptions] = "nosniff";
        headers["Referrer-Policy"] = ReferrerPolicy;
        headers["X-Robots-Tag"] = "noindex, nofollow";
        headers[HeaderNames.XFrameOptions] = "DENY";
        headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups";
        headers["Permissions-Policy"] = PermissionsPolicy;
        // A 429 of the limiter already says no-store; the round page carries nicknames and is never stored, the legal
        // pages are checked again on each visit.
        if (response.StatusCode != StatusCodes.Status429TooManyRequests)
        {
            headers[HeaderNames.CacheControl] = cache;
        }

        return Task.CompletedTask;
    }

    private static Task WriteFileHeaders(HttpResponse response, PathString path)
    {
        response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
        response.Headers["Referrer-Policy"] = ReferrerPolicy;
        if (response.StatusCode == StatusCodes.Status200OK)
        {
            response.Headers[HeaderNames.CacheControl] = path.StartsWithSegments(BrandPrefix, StringComparison.Ordinal)
                ? BrandCache
                : path.Value?.StartsWith(HashedAssetsPrefix, StringComparison.Ordinal) == true ? ImmutableCache : UnhashedFileCache;
        }

        return Task.CompletedTask;
    }
}
