using System.Text.Json;
using Microsoft.Extensions.FileProviders;

namespace Sacou.Api.Web;

/// <summary>A page's script and styles, with the hash in their names (ADR 0070, D7).</summary>
internal sealed record WebEntry(string Script, IReadOnlyList<string> Styles);

/// <summary>Where the pages find their built files. A fake in the tests, so the HTML does not depend on a local build.</summary>
internal interface IWebAssets
{
    /// <summary>The entry of the round page, or null without the build of <c>apps/web</c> (the page then has no script).</summary>
    WebEntry? Round { get; }

    /// <summary>The entry of the invite page (<c>/c</c>), or null without the build.</summary>
    WebEntry? Invite { get; }
}

/// <summary>
/// Reads <c>wwwroot/web/manifest.json</c>, written by Vite (<c>pnpm --filter @sacou/web build</c>), once. The Docker image
/// always carries it (the Node stage of the Dockerfile, checked by an architecture test); a developer machine without
/// the build serves the pages without a script.
/// </summary>
internal sealed class ManifestWebAssets : IWebAssets
{
    public const string ManifestPath = "web/manifest.json";
    public const string EntryKey = "src/main.ts";
    public const string InviteEntryKey = "src/invite-main.ts";
    public const string PublicPrefix = "/web/";

    public ManifestWebAssets(IWebHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(environment);
        using var manifest = Read(environment.WebRootFileProvider.GetFileInfo(ManifestPath));
        Round = manifest is null ? null : Parse(manifest.RootElement, EntryKey);
        Invite = manifest is null ? null : Parse(manifest.RootElement, InviteEntryKey);
    }

    public WebEntry? Round { get; }

    public WebEntry? Invite { get; }

    internal static JsonDocument? Read(IFileInfo manifest)
    {
        if (!manifest.Exists)
        {
            return null;
        }

        using var stream = manifest.CreateReadStream();
        return JsonDocument.Parse(stream);
    }

    /// <summary>
    /// The entry's script and its styles, those of the chunks it imports included: the two pages share the styles and
    /// the Firebase code, which Vite may move to a common chunk.
    /// </summary>
    internal static WebEntry? Parse(JsonElement root, string entryKey)
    {
        if (!root.TryGetProperty(entryKey, out var entry) || !entry.TryGetProperty("file", out var file) || file.GetString() is not { } script)
        {
            return null;
        }

        var styles = new List<string>();
        CollectStyles(root, entryKey, styles, new HashSet<string>(StringComparer.Ordinal));
        return new WebEntry(PublicPrefix + script, styles);
    }

    private static void CollectStyles(JsonElement root, string key, List<string> styles, HashSet<string> seen)
    {
        if (!seen.Add(key) || !root.TryGetProperty(key, out var chunk))
        {
            return;
        }

        foreach (var import in Strings(chunk, "imports"))
        {
            CollectStyles(root, import, styles, seen);
        }

        styles.AddRange(Strings(chunk, "css").Select(path => PublicPrefix + path).Where(path => !styles.Contains(path, StringComparer.Ordinal)));
    }

    private static IEnumerable<string> Strings(JsonElement chunk, string property) =>
        chunk.TryGetProperty(property, out var list) && list.ValueKind == JsonValueKind.Array
            ? list.EnumerateArray().Select(item => item.GetString()).OfType<string>()
            : [];
}
