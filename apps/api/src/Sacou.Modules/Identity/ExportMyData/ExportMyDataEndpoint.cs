using System.Globalization;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using Sacou.Http;

namespace Sacou.Modules.Identity.ExportMyData;

/// <summary>
/// <c>GET /v1/me/export</c> (E3.16, ADR 0056, D9): everything the API keeps about the caller, as a JSON file the app
/// hands to the share sheet. No recent login (Gabriel, question 65): exporting destroys nothing. Never cached
/// anywhere (<c>no-store</c>), refusals included; the file name carries the UTC day only, never a name.
/// </summary>
internal static class ExportMyDataEndpoint
{
    public const string Route = "/v1/me/export";
    public const string Name = "ExportMyData";
    public const string FileNamePrefix = "sacou-meus-dados-";
    public const string FileNameExtension = ".json";

    private const string NoStore = "no-store";
    private const string Attachment = "attachment";
    private const string DayFormat = "yyyy-MM-dd";

    public static IEndpointRouteBuilder MapExportMyData(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(Route, HandleAsync).WithName(Name).RequireAuthorization()
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    /// <summary>The name of the file for <paramref name="day"/>, such as <c>sacou-meus-dados-2026-11-15.json</c>.</summary>
    public static string FileName(DateOnly day) =>
        FileNamePrefix + day.ToString(DayFormat, CultureInfo.InvariantCulture) + FileNameExtension;

    private static async Task<Results<Ok<JsonObject>, ProblemHttpResult>> HandleAsync(
        HttpContext context, ExportMyDataHandler handler, CancellationToken cancellationToken)
    {
        context.Response.Headers[HeaderNames.CacheControl] = NoStore;
        var export = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        if (export.IsSuccess)
        {
            var disposition = new ContentDispositionHeaderValue(Attachment) { FileName = $"\"{FileName(export.Value.Day)}\"" };
            context.Response.Headers[HeaderNames.ContentDisposition] = disposition.ToString();
        }

        return export.ToHttpResult(value => TypedResults.Ok(value.Document));
    }
}
