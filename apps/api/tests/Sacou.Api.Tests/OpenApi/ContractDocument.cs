using System.Net;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using HttpJsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace Sacou.Api.Tests.OpenApi;

/// <summary>
/// The OpenAPI document of the real API, served in Development as the committed file is made: JSON
/// normalized (two-space indent, LF, a final newline), so the comparison is text against text.
/// </summary>
internal static class ContractDocument
{
    public const string DocumentPath = "/openapi/v1.json";
    public const string UpdateVariable = "SACOU_UPDATE_OPENAPI";

    private const string SolutionFile = "Sacou.slnx";
    private const string LineFeed = "\n";

    /// <summary>Relaxed escaping, so <c>application/problem+json</c> stays readable in the diff of a PR.</summary>
    private static readonly JsonSerializerOptions Written = new()
    {
        WriteIndented = true,
        IndentSize = 2,
        NewLine = LineFeed,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static string CommittedPath => Path.Combine(RepositoryRoot(), "apps", "api", "openapi", "v1.json");

    public static async Task<string> FetchAsync()
    {
        await using var factory = new SacouApiFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(DocumentPath, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return Normalize(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    public static async Task<JsonObject> ParsedAsync() => JsonNode.Parse(await FetchAsync())!.AsObject();

    public static string Normalize(string json) => JsonNode.Parse(json)!.ToJsonString(Written) + LineFeed;

    public static JsonSerializerOptions ApiJsonOptions()
    {
        using var factory = new SacouApiFactory();
        return factory.Services.GetRequiredService<IOptions<HttpJsonOptions>>().Value.SerializerOptions;
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, SolutionFile)))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException($"{SolutionFile} not found above the test output.");
    }
}
