using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using System.Text.Unicode;
using Microsoft.Extensions.WebEncoders;
using Microsoft.Extensions.Options;
using Sacou.Api.Web.Legal;
using Sacou.Http.RateLimiting;

namespace Sacou.Api.Web;

/// <summary>
/// The round's public page (E3.12, ADR 0070, D4 to D7), the invite page <c>/c</c> and the legal pages <c>/termos</c>
/// and <c>/privacidade</c> (E6.1, ADR 0083): Razor Pages for those paths only, their files from
/// <c>wwwroot</c>, its headers, and the 429 written for a person. Nothing here makes a session or a cookie.
/// </summary>
internal static partial class WebSetup
{
    public const string PagesRoot = "/Web/Pages";

    private static readonly string[] PageMethods = [HttpMethods.Get, HttpMethods.Head];

    public static IServiceCollection AddSacouWeb(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddRazorPages(options => options.RootDirectory = PagesRoot);
        // Accents stay letters ("Vôlei", not "V&#xF4;lei") in the page and in the preview; <, >, &, quotes and the
        // invisible characters are still encoded (ADR 0070, D5).
        services.Configure<WebEncoderOptions>(options => options.TextEncoderSettings = new TextEncoderSettings(UnicodeRanges.All));
        services.AddOptions<FirebaseWebOptions>().Bind(configuration.GetSection(FirebaseWebOptions.SectionName)).ValidateOnStart();
        services.AddSingleton<IValidateOptions<FirebaseWebOptions>, FirebaseWebOptionsValidator>();
        services.AddOptions<WebPageOptions>().Bind(configuration.GetSection(WebPageOptions.SectionName));
        services.AddOptions<WebSecurityOptions>().Bind(configuration.GetSection(WebSecurityOptions.SectionName)).ValidateOnStart();
        services.AddSingleton<IValidateOptions<WebSecurityOptions>, WebSecurityOptionsValidator>();
        services.AddSingleton<ContentSecurityPolicy>();
        services.AddSingleton<IWebAssets, ManifestWebAssets>();
        services.AddSingleton<IRateLimitedPage, RateLimitedPage>();
        // The terms and the privacy policy (E6.1, ADR 0083): read once, and an invalid text stops the start.
        services.AddSingleton<ILegalDocumentSource, EmbeddedLegalDocumentSource>();
        services.AddSingleton<ILegalDocuments, LegalDocuments>();
        // The data protection contact of /excluir-conta (E6.4): checked on start, required in Production.
        services.AddOptions<DataProtectionOptions>().Bind(configuration.GetSection(DataProtectionOptions.SectionName)).ValidateOnStart();
        services.AddSingleton<IValidateOptions<DataProtectionOptions>, DataProtectionOptionsValidator>();
        return services;
    }

    /// <summary>
    /// Builds the legal texts while the host starts, no background work (ADR 0068, D2): a text the reader refuses throws with
    /// the file and the line, so a deploy with it never answers.
    /// </summary>
    public static IApplicationBuilder ReadSacouLegalDocuments(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        _ = app.ApplicationServices.GetRequiredService<ILegalDocuments>();
        return app;
    }

    /// <summary>Before the rate limiter and the static files, so every answer of the page and its files has the headers.</summary>
    public static IApplicationBuilder UseSacouWebHeaders(this IApplicationBuilder app) => app.UseMiddleware<WebSecurityHeaders>();

    public static IApplicationBuilder UseSacouWebFiles(this IApplicationBuilder app) => app.UseStaticFiles();

    /// <summary>
    /// GET and HEAD only: any other method on the page finds no anonymous endpoint and the fallback policy answers 401
    /// before the routing's 405 (ADR 0070, D4); never a page handler.
    /// </summary>
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
