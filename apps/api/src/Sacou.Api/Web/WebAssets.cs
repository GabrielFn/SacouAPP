using System.Text.Json;
using Microsoft.Extensions.FileProviders;

namespace Sacou.Api.Web;

/// <summary>The round page's script and styles, with the hash in their names (ADR 0070, D7).</summary>
internal sealed record WebEntry(string Script, IReadOnlyList<string> Styles);

/// <summary>Where the page finds its built files. A fake in the tests, so the HTML does not depend on a local build.</summary>
internal interface IWebAssets
{
    /// <summary>The entry of the round page, or null without the build of <c>apps/web</c> (the page then has no script).</summary>
    WebEntry? Round { get; }
}

/// <summary>
/// Reads <c>wwwroot/web/manifest.json</c>, written by Vite (<c>pnpm --filter @sacou/web build</c>), once. The Docker image
/// always carries it (the Node stage of the Dockerfile, checked by an architecture test); a developer machine without
/// the build serves the page without a script, read-only.
/// </summary>
internal sealed class ManifestWebAssets : IWebAssets
{
    public const string ManifestPath = "web/manifest.json";
    public const string EntryKey = "src/main.ts";
    public const string PublicPrefix = "/web/";

    public ManifestWebAssets(IWebHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(environment);
        Round = Read(environment.WebRootFileProvider.GetFileInfo(ManifestPath));
    }

    public WebEntry? Round { get; }

    internal static WebEntry? Read(IFileInfo manifest)
    {
        if (!manifest.Exists)
        {
            return null;
        }

        using var stream = manifest.CreateReadStream();
        using var document = JsonDocument.Parse(stream);
        return Parse(document.RootElement);
    }

    internal static WebEntry? Parse(JsonElement root)
    {
        if (!root.TryGetProperty(EntryKey, out var entry) || !entry.TryGetProperty("file", out var file) || file.GetString() is not { } script)
        {
            return null;
        }

        IReadOnlyList<string> styles = entry.TryGetProperty("css", out var css)
            ? [.. css.EnumerateArray().Select(item => item.GetString()).OfType<string>().Select(path => PublicPrefix + path)]
            : [];
        return new WebEntry(PublicPrefix + script, styles);
    }
}
