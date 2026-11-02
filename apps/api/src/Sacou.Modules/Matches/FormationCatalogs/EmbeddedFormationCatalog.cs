using System.Reflection;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.FormationCatalogs;

/// <summary>Reads the catalog built into this assembly: there is no copy and no disk access in production (ADR 0006).</summary>
internal static class EmbeddedFormationCatalog
{
    public const string ResourceName = "Sacou.Modules.Matches.formations.json";

    public static FormationCatalog Load() => Load(typeof(EmbeddedFormationCatalog).Assembly, ResourceName);

    public static FormationCatalog Load(Assembly assembly, string resourceName)
    {
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource \"{resourceName}\" not found.");
        return FormationCatalogParser.Parse(stream);
    }
}
