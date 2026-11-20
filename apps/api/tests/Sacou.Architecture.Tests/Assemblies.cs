using System.Reflection;
using Sacou.Http;
using Sacou.Modules.Surface;
using Sacou.Shared.Results;

namespace Sacou.Architecture.Tests;

internal static class Assemblies
{
    private const string ModuleAssemblyPattern = "Sacou.Modules.*.dll";

    internal static readonly IReadOnlyList<string> ModuleCatalog =
    [
        "Sacou.Modules.Groups",
        "Sacou.Modules.Identity",
        "Sacou.Modules.Matches",
        "Sacou.Modules.Notifications",
        "Sacou.Modules.Payments",
        "Sacou.Modules.Sessions",
        "Sacou.Modules.Stats",
        "Sacou.Modules.Summaries",
    ];

    internal static readonly Assembly Fixtures = typeof(SurfaceModule).Assembly;

    internal static readonly Assembly Shared = typeof(Result).Assembly;

    internal static readonly Assembly Http = typeof(ProblemResults).Assembly;

    internal static readonly Lazy<IReadOnlyList<Assembly>> RealModules = new(
        () => [.. ModuleFilesInOutput().Select(Assembly.LoadFrom)]);

    internal static readonly Lazy<IReadOnlyList<Assembly>> ModulesAndShared = new(
        () => [.. RealModules.Value, Shared, Http]);

    internal static readonly Lazy<ArchUnitNET.Domain.Architecture> FixturesArchitecture = new(
        () => ArchitectureDependencyRules.Load([Fixtures]));

    internal static readonly Lazy<ArchUnitNET.Domain.Architecture> RealArchitecture = new(
        () => ArchitectureDependencyRules.Load(RealModules.Value));

    internal static IReadOnlyList<string> ModuleNamesInOutput() =>
        [.. ModuleFilesInOutput().Select(path => Path.GetFileNameWithoutExtension(path))];

    private static string[] ModuleFilesInOutput() =>
        Directory.GetFiles(AppContext.BaseDirectory, ModuleAssemblyPattern);
}
