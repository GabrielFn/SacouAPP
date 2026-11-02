using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

namespace Sacou.Architecture.Tests;

/// <summary>Rules that metadata alone answers, so they need no IL reader.</summary>
internal static partial class ArchitectureReflectionRules
{
    private const string TestAssemblySuffix = ".Tests";
    private const string CompilerGeneratedPrefix = "<";
    private const string EmbeddedAttributeName = "Microsoft.CodeAnalysis.EmbeddedAttribute";

    /// <summary>Closed list: a BCL assembly that means I/O, such as System.Net.Http, must not reach Shared.</summary>
    private static readonly HashSet<string> AllowedSharedReferences =
    [
        "System.Collections",
        "System.Linq",
        "System.Memory",
        "System.Runtime",
        "System.Threading",
    ];

    private const BindingFlags EveryDeclaredMethod =
        BindingFlags.DeclaredOnly | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance;

    /// <summary>
    /// DllImport is a pseudo-attribute: it becomes method metadata, with no type reference for the IL
    /// rule to find, so a P/Invoke needs this rule of its own.
    /// </summary>
    internal static IReadOnlyList<string> DomainPInvokeViolations(Assembly assembly) =>
        [.. from type in assembly.GetTypes()
            where ArchitectureDependencyRules.IsDomainType(type.FullName ?? type.Name)
            from method in type.GetMethods(EveryDeclaredMethod)
            where method.Attributes.HasFlag(MethodAttributes.PinvokeImpl)
            select $"{type.FullName}.{method.Name}"];

    /// <summary>Exported types outside Contracts, except the module's own entry class.</summary>
    internal static IReadOnlyList<string> PublicSurfaceViolations(Assembly assembly) =>
        [.. assembly.GetExportedTypes()
            .Where(type => !IsAllowedPublicType(type))
            .Select(type => type.FullName ?? type.Name)];

    /// <summary>Friend assemblies other than the assembly's own test project.</summary>
    internal static IReadOnlyList<string> InternalsVisibleToViolations(Assembly assembly)
    {
        var ownTests = assembly.GetName().Name + TestAssemblySuffix;
        return
        [.. assembly.GetCustomAttributes<InternalsVisibleToAttribute>()
            .Select(attribute => attribute.AssemblyName)
            .Where(friend => friend != ownTests)];
    }

    /// <summary>Source types whose namespace does not start with the assembly name.</summary>
    internal static IReadOnlyList<string> NamespaceViolations(Assembly assembly)
    {
        var assemblyName = assembly.GetName().Name ?? string.Empty;
        return
        [.. assembly.GetTypes()
            .Where(type => !IsCompilerGenerated(type) && !IsInNamespace(type, assemblyName))
            .Select(type => type.FullName ?? type.Name)];
    }

    /// <summary>Returns the differences between the module names found and the module catalog.</summary>
    internal static IReadOnlyList<string> CatalogViolations(IEnumerable<string> found, IEnumerable<string> catalog)
    {
        var foundSet = found.ToHashSet();
        var catalogSet = catalog.ToHashSet();
        return
        [
            .. catalogSet.Except(foundSet).Select(name => $"Missing module: {name}"),
            .. foundSet.Except(catalogSet).Select(name => $"Module outside the catalog: {name}"),
        ];
    }

    /// <summary>Exported namespaces outside the closed list: Shared must not become a dumping ground.</summary>
    internal static IReadOnlyList<string> SharedNamespaceViolations(Assembly assembly, IEnumerable<string> allowed) =>
        [.. assembly.GetExportedTypes()
            .Select(type => type.Namespace ?? string.Empty)
            .Distinct()
            .Except(allowed)];

    /// <summary>Referenced assemblies outside the closed list. This also covers modules and ASP.NET.</summary>
    internal static IReadOnlyList<string> SharedReferenceViolations(Assembly assembly) =>
        SharedReferenceViolations(assembly.GetReferencedAssemblies().Select(reference => reference.Name ?? string.Empty));

    internal static IReadOnlyList<string> SharedReferenceViolations(IEnumerable<string> references) =>
        [.. references.Where(name => !AllowedSharedReferences.Contains(name))];

    private static bool IsAllowedPublicType(Type type)
    {
        var @namespace = type.Namespace ?? string.Empty;
        var module = ModuleRootPattern().Match(@namespace);
        return ContractsPattern().IsMatch(@namespace)
            || (module.Success && type.Name == module.Groups[1].Value + "Module");
    }

    private static bool IsInNamespace(Type type, string @namespace) =>
        type.Namespace == @namespace
        || (type.Namespace ?? string.Empty).StartsWith(@namespace + ".", StringComparison.Ordinal);

    private static bool IsCompilerGenerated(Type type) =>
        type.Name.StartsWith(CompilerGeneratedPrefix, StringComparison.Ordinal)
        || type.FullName == EmbeddedAttributeName
        || type.GetCustomAttributesData().Any(data => data.AttributeType.FullName == EmbeddedAttributeName);

    [GeneratedRegex(@"^Sacou\.Modules\.\w+\.Contracts(\.|$)")]
    private static partial Regex ContractsPattern();

    [GeneratedRegex(@"^Sacou\.Modules\.(\w+)$")]
    private static partial Regex ModuleRootPattern();
}
