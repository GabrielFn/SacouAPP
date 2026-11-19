using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Sacou.Http.RateLimiting;

namespace Sacou.Api.Web;

/// <summary>
/// The round's public page (E3.12, ADR 0070, D4 to D7): Razor Pages for <c>/r/{code}</c> only, its files from
/// <c>wwwroot</c>, its headers, and the 429 written for a person. Nothing here makes a session or a cookie.
/// </summary>
internal static partial class WebSetup
{
    public const string PagesRoot = "/Web/Pages";

    private static readonly string[] PageMethods = [HttpMethods.Get, HttpMethods.Head];

    public static IServiceCollection AddSacouWeb(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddRazorPages(options => options.RootDirectory = PagesRoot);
        services.AddOptions<FirebaseWebOptions>().Bind(configuration.GetSection(FirebaseWebOptions.SectionName)).ValidateOnStart();
        services.AddSingleton<IValidateOptions<FirebaseWebOptions>, FirebaseWebOptionsValidator>();
        services.AddOptions<WebPageOptions>().Bind(configuration.GetSection(WebPageOptions.SectionName));
        services.AddOptions<WebSecurityOptions>().Bind(configuration.GetSection(WebSecurityOptions.SectionName)).ValidateOnStart();
        services.AddSingleton<IValidateOptions<WebSecurityOptions>, WebSecurityOptionsValidator>();
        services.AddSingleton<ContentSecurityPolicy>();
        services.AddSingleton<IWebAssets, ManifestWebAssets>();
        services.AddSingleton<IRateLimitedPage, RateLimitedPage>();
        return services;
    }

    /// <summary>Before the rate limiter and the static files, so every answer of the page and its files has the headers.</summary>
    public static IApplicationBuilder UseSacouWebHeaders(this IApplicationBuilder app) => app.UseMiddleware<WebSecurityHeaders>();

    public static IApplicationBuilder UseSacouWebFiles(this IApplicationBuilder app) => app.UseStaticFiles();

    /// <summary>GET and HEAD only: any other method on the page is a 405 from the routing, never a page handler.</summary>
    public static PageActionEndpointConventionBuilder MapSacouWeb(this IEndpointRouteBuilder endpoints)
    {
        var pages = endpoints.MapRazorPages();
        pages.Add(endpoint => endpoint.Metadata.Add(new HttpMethodMetadata(PageMethods)));
        return pages;
    }

    /// <summary>A host name only: the value joins the CSP, so nothing that could end a directive.</summary>
    internal sealed class FirebaseWebOptionsValidator : IValidateOptions<FirebaseWebOptions>
    {
        public ValidateOptionsResult Validate(string? name, FirebaseWebOptions options)
        {
            ArgumentNullException.ThrowIfNull(options);
            return string.IsNullOrWhiteSpace(options.AuthDomain) || HostName().IsMatch(options.AuthDomain)
                ? ValidateOptionsResult.Success
                : ValidateOptionsResult.Fail($"{FirebaseWebOptions.SectionName}:{nameof(options.AuthDomain)} must be a host name.");
        }
    }

    [GeneratedRegex(@"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", RegexOptions.CultureInvariant)]
    private static partial Regex HostName();
}

/// <summary>The 429 of the round page: a short HTML in pt-BR, no detail of the limit (ADR 0070, D6).</summary>
internal sealed class RateLimitedPage : IRateLimitedPage
{
    public Task WriteAsync(HttpContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        context.Response.ContentType = "text/html; charset=utf-8";
        var body = $"<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>{WebTexts.Brand}</title></head><body><p>{WebTexts.TooManyRequests}</p></body></html>";
        return context.Response.WriteAsync(body, cancellationToken);
    }
}
