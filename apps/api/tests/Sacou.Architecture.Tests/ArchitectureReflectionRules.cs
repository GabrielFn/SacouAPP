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
        "System.Collections.Immutable",
        "System.Linq",
        "System.Memory",
        "System.Runtime",
        "System.Threading",
    ];

    /// <summary>
    /// Closed list of friends besides the own tests: the Notifications lets the integration tests swap its internal push
    /// port, which carries the token, for a fake (ADR 0069, D5), so the port never has to be public.
    /// </summary>
    private static readonly HashSet<(string Assembly, string Friend)> AllowedFriends =
    [
        ("Sacou.Modules.Notifications", "Sacou.Integration.Tests"),
    ];

    private const string UserIdSuffix = "UserId";
    private const string ModuleAssemblyPrefix = "Sacou.Modules.";
    private const string ApiAssemblyName = "Sacou.Api";
    private const string ConstructorName = "ctor";
    private const char MemberSeparator = ':';

    /// <summary>The names revision A4 forbids, compared without case.</summary>
    private static readonly HashSet<string> PersonalDataNames = new(
        ["email", "name", "nickname", "phone", "pix", "photo", "userId"],
        StringComparer.OrdinalIgnoreCase);

    private const BindingFlags EveryDeclaredMember =
        BindingFlags.DeclaredOnly | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance;

    /// <summary>
    /// DllImport is a pseudo-attribute: it becomes method metadata, with no type reference for the IL
    /// rule to find, so a P/Invoke needs this rule of its own.
    /// </summary>
    internal static IReadOnlyList<string> DomainPInvokeViolations(Assembly assembly) =>
        [.. from type in assembly.GetTypes()
            where ArchitectureDependencyRules.IsDomainType(type.FullName ?? type.Name)
            from method in type.GetMethods(EveryDeclaredMember)
            where method.Attributes.HasFlag(MethodAttributes.PinvokeImpl)
            select $"{type.FullName}.{method.Name}"];

    /// <summary>
    /// Properties and fields of types under the namespace whose name, ignoring case and leading
    /// underscores, is personal data: events carry only ids (security review A4, ADR 0033 D12).
    /// </summary>
    internal static IReadOnlyList<string> PersonalDataNameViolations(Assembly assembly, string namespacePrefix) =>
        [.. from type in assembly.GetTypes()
            where (type.FullName ?? string.Empty).StartsWith(namespacePrefix + ".", StringComparison.Ordinal)
            from name in MemberNames(type).Concat(ConstructorParameterNames(type))
            where !name.Split(MemberSeparator)[^1].StartsWith(CompilerGeneratedPrefix, StringComparison.Ordinal)
                && IsPersonalDataName(name.Split(MemberSeparator)[^1].TrimStart('_'))
            select $"{type.FullName}.{name}"];

    private static IEnumerable<string> MemberNames(Type type) =>
        type.GetProperties(EveryDeclaredMember).Cast<MemberInfo>()
            .Concat(type.GetFields(EveryDeclaredMember))
            .Select(member => member.Name);

    /// <summary>A constructor can take a name that no property keeps, such as a parameter used only to compute.</summary>
    private static IEnumerable<string> ConstructorParameterNames(Type type) =>
        from constructor in type.GetConstructors(EveryDeclaredMember)
        from parameter in constructor.GetParameters()
        select $"{ConstructorName}{MemberSeparator}{parameter.Name}";

    private static bool IsPersonalDataName(string name) =>
        PersonalDataNames.Contains(name)
        || name.EndsWith(UserIdSuffix, StringComparison.OrdinalIgnoreCase);

    /// <summary>Exported types outside Contracts, except the module's own entry class.</summary>
    internal static IReadOnlyList<string> PublicSurfaceViolations(Assembly assembly) =>
        [.. assembly.GetExportedTypes()
            .Where(type => !IsAllowedPublicType(type))
            .Select(type => type.FullName ?? type.Name)];

    /// <summary>Friend assemblies other than the assembly's own test project and the closed list of <see cref="AllowedFriends"/>.</summary>
    internal static IReadOnlyList<string> InternalsVisibleToViolations(Assembly assembly)
    {
        var name = assembly.GetName().Name ?? string.Empty;
        var ownTests = name + TestAssemblySuffix;
        return
        [.. assembly.GetCustomAttributes<InternalsVisibleToAttribute>()
            .Select(attribute => attribute.AssemblyName)
            .Where(friend => friend != ownTests && !AllowedFriends.Contains((name, friend)))];
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

    /// <summary>Sacou.Http may know Shared and ASP.NET, never a module nor the API (ADR 0039).</summary>
    internal static IReadOnlyList<string> HttpReferenceViolations(Assembly assembly) =>
        HttpReferenceViolations(assembly.GetReferencedAssemblies().Select(reference => reference.Name ?? string.Empty));

    internal static IReadOnlyList<string> HttpReferenceViolations(IEnumerable<string> references) =>
        [.. references.Where(name => name.StartsWith(ModuleAssemblyPrefix, StringComparison.Ordinal) || name == ApiAssemblyName)];

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

    /// <summary>A nested type counts with its parent: a constant array emits <c>&lt;PrivateImplementationDetails&gt;+__StaticArrayInitTypeSize=16</c>.</summary>
    private static bool IsCompilerGenerated(Type type) =>
        type.Name.StartsWith(CompilerGeneratedPrefix, StringComparison.Ordinal)
        || (type.DeclaringType is { } declaringType && IsCompilerGenerated(declaringType))
        || type.FullName == EmbeddedAttributeName
        || type.GetCustomAttributesData().Any(data => data.AttributeType.FullName == EmbeddedAttributeName);

    [GeneratedRegex(@"^Sacou\.Modules\.\w+\.Contracts(\.|$)")]
    private static partial Regex ContractsPattern();

    [GeneratedRegex(@"^Sacou\.Modules\.(\w+)$")]
    private static partial Regex ModuleRootPattern();
}
