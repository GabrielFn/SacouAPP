using System.Text.RegularExpressions;
using ArchUnitNET.Domain;
using ArchUnitNET.Domain.Extensions;
using ArchUnitNET.Loader;

namespace Sacou.Architecture.Tests;

internal sealed record Violation(string Type, string Detail)
{
    /// <summary>Top-level type, so that closures and state machines count for the type that declared them.</summary>
    internal string DeclaringType => Type.Split('+', '/')[0];

    public override string ToString() => $"{Type}: {Detail}";
}

/// <summary>Rules that need method bodies, so they read IL through ArchUnitNET.</summary>
internal static partial class ArchitectureDependencyRules
{
    private const string SharedNamespacePrefix = "Sacou.Shared";
    private const string CompilerGeneratedPrefix = "<";

    /// <summary>Allow list by exact namespace: a future library fails without editing this test.</summary>
    private static readonly HashSet<string> AllowedDomainNamespaces =
    [
        "System",
        "System.Collections",
        "System.Collections.Generic",
        "System.Collections.Immutable",
        "System.Collections.ObjectModel",
        "System.Diagnostics.CodeAnalysis",
        "System.Globalization",
        "System.Linq",
        "System.Numerics",
        "System.Runtime.CompilerServices",
        "System.Text",
        "System.Text.RegularExpressions",
        "System.Threading",
        "System.Threading.Tasks",
    ];

    /// <summary>
    /// What the compiler emits from namespaces that also hold Process or Marshal. Each entry is here
    /// because Domain_WithAllowedDependency_IsNotReported fails without it, in Debug or in Release.
    /// </summary>
    private static readonly HashSet<string> AllowedDomainTypes =
    [
        "System.Diagnostics.DebuggerStepThroughAttribute",
        "System.Runtime.InteropServices.CollectionsMarshal",
        "System.Runtime.InteropServices.ImmutableCollectionsMarshal",
        "System.Runtime.InteropServices.MemoryMarshal",
    ];

    /// <summary>A block list because System does not fit an allow list: records and closures use dozens of its types.</summary>
    private static readonly HashSet<string> ForbiddenDomainTypes =
    [
        "System.Activator",
        "System.AppContext",
        "System.AppDomain",
        "System.Console",
        "System.Environment",
        "System.GC",
    ];

    /// <summary>
    /// Clock, randomness, identity, threads and hash-ordered collections: the court session state must
    /// depend only on the events (ADR 0033, D10). Other domains may still use them, so this is scoped.
    /// </summary>
    private static readonly string[] PersonalDataNamespaces = ["Sacou.Modules.Identity", "Sacou.Shared.Levels"];

    private static readonly string[] PersonalDataTypeNames = ["Nickname", "PlayerProfile", "MemberLevel"];

    private static readonly HashSet<string> NonDeterministicTypes =
    [
        "System.DateTime",
        "System.DateTimeOffset",
        "System.TimeProvider",
        "System.Random",
        "System.Guid",
        "System.Threading.Thread",
        "System.Threading.Tasks.Task",
        "System.Threading.Tasks.Task`1",
        "System.Threading.Tasks.ValueTask",
        "System.Threading.Tasks.ValueTask`1",
        "System.Threading.Tasks.Parallel",
        "System.Collections.Generic.HashSet`1",
        "System.Collections.Generic.Dictionary`2",
    ];

    internal static ArchUnitNET.Domain.Architecture Load(IEnumerable<System.Reflection.Assembly> assemblies) =>
        new ArchLoader().LoadAssemblies([.. assemblies]).Build();

    internal static bool IsDomainType(string fullName) => DomainNamespacePattern().IsMatch(fullName);

    internal static IReadOnlyList<Violation> DomainViolations(ArchUnitNET.Domain.Architecture architecture) =>
        [.. from type in architecture.Types
            let domain = DomainNamespacePattern().Match(type.FullName)
            where domain.Success
            from dependency in type.GetTypeDependencies()
            where !IsAllowedInDomain(dependency, domain.Value)
            select new Violation(type.FullName, $"Domain depends on {dependency.FullName}")];

    /// <summary>Types under the namespace that depend on a clock, randomness, an identity, a thread or a hash-ordered collection.</summary>
    internal static IReadOnlyList<Violation> DeterministicDomainViolations(
        ArchUnitNET.Domain.Architecture architecture,
        string namespacePrefix) =>
        [.. from type in architecture.Types
            where IsInNamespace(type.FullName, namespacePrefix)
            from dependency in type.GetTypeDependencies()
            where NonDeterministicTypes.Contains(OpenTypeName(dependency.FullName))
            select new Violation(type.FullName, $"Court session domain depends on {dependency.FullName}")];

    /// <summary>
    /// Types under the namespace that depend on the profile or the level (ADR 0051, D12): events carry only ids, so no
    /// event type may reach the Identity module, the shared level scale or a type named for a nickname, a profile or a
    /// member level outside the namespace (inside it, the name rule of the members applies).
    /// </summary>
    internal static IReadOnlyList<Violation> PersonalDataTypeViolations(
        ArchUnitNET.Domain.Architecture architecture,
        string namespacePrefix) =>
        [.. from type in architecture.Types
            where IsInNamespace(type.FullName, namespacePrefix)
            from dependency in type.GetTypeDependencies()
            where !IsInNamespace(dependency.FullName, namespacePrefix) && IsPersonalDataType(dependency.FullName)
            select new Violation(type.FullName, $"Event type depends on {dependency.FullName}")];

    internal static IReadOnlyList<Violation> ModuleBoundaryViolations(ArchUnitNET.Domain.Architecture architecture) =>
        [.. from type in architecture.Types
            let origin = ModuleNamePattern().Match(type.FullName)
            where origin.Success
            from dependency in type.GetTypeDependencies()
            where CrossesModuleBoundary(dependency.FullName, origin.Groups[1].Value)
            select new Violation(type.FullName, $"Module depends on {dependency.FullName}")];

    private static bool IsAllowedInDomain(IType dependency, string ownDomainNamespace)
    {
        var fullName = dependency.FullName;
        return dependency is GenericParameter
            || fullName.StartsWith(CompilerGeneratedPrefix, StringComparison.Ordinal)
            || IsInNamespace(fullName, ownDomainNamespace)
            || IsInNamespace(fullName, SharedNamespacePrefix)
            || (!ForbiddenDomainTypes.Contains(TopLevelName(fullName))
                && (AllowedDomainNamespaces.Contains(dependency.Namespace.FullName) || AllowedDomainTypes.Contains(fullName)));
    }

    /// <summary>So that Environment+SpecialFolder falls with Environment.</summary>
    private static string TopLevelName(string fullName) => fullName.Split('+', '/')[0];

    /// <summary>The top-level type without generic arguments, so <c>Dictionary`2+Enumerator</c> falls with <c>Dictionary`2</c>.</summary>
    private static string OpenTypeName(string fullName) => TopLevelName(fullName).Split('[')[0];

    private static bool CrossesModuleBoundary(string dependency, string originModule)
    {
        if (ApiNamespacePattern().IsMatch(dependency))
        {
            return true;
        }

        var target = ModuleNamePattern().Match(dependency);
        return target.Success
            && target.Groups[1].Value != originModule
            && !ContractsNamespacePattern().IsMatch(dependency);
    }

    private static bool IsPersonalDataType(string fullName) =>
        PersonalDataNamespaces.Any(prefix => IsInNamespace(fullName, prefix))
        || PersonalDataTypeNames.Any(name => fullName.Contains(name, StringComparison.Ordinal));

    private static bool IsInNamespace(string fullName, string namespacePrefix) =>
        fullName.StartsWith(namespacePrefix + ".", StringComparison.Ordinal);

    /// <summary>Domain at any depth of the module namespace, up to its first occurrence.</summary>
    [GeneratedRegex(@"^Sacou\.Modules\.\w+(\.\w+)*?\.Domain(?=\.)")]
    private static partial Regex DomainNamespacePattern();

    [GeneratedRegex(@"^Sacou\.Modules\.(\w+)\.")]
    private static partial Regex ModuleNamePattern();

    [GeneratedRegex(@"^Sacou\.Modules\.\w+\.Contracts\.")]
    private static partial Regex ContractsNamespacePattern();

    [GeneratedRegex(@"^Sacou\.Api\.")]
    private static partial Regex ApiNamespacePattern();
}
