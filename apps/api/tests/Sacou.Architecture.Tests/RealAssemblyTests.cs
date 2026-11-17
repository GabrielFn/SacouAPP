using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>The rules applied to the real code. <see cref="PlantedViolationTests"/> proves the rules can fail.</summary>
public sealed class RealAssemblyTests
{
    private const string CourtSessionsNamespace = "Sacou.Modules.Matches.Domain.CourtSessions";
    private const string CourtSessionJsonNamespace = "Sacou.Modules.Matches.CourtSessionJson";

    private static readonly string[] SharedPublicNamespaces = ["Sacou.Shared.Results", "Sacou.Shared.Members", "Sacou.Shared.Text", "Sacou.Shared.Persistence", "Sacou.Shared.Levels"];

    private static readonly string[] HttpPublicNamespaces = ["Sacou.Http", "Sacou.Http.RateLimiting"];

    [Fact]
    public void ModuleAssembliesInOutput_MatchTheCatalog()
    {
        ViolationAssert.None(ArchitectureReflectionRules.CatalogViolations(
            Assemblies.ModuleNamesInOutput(), Assemblies.ModuleCatalog));
    }

    [Fact]
    public void ModuleProjectsInFolders_MatchTheCatalog()
    {
        ViolationAssert.None(ArchitectureReflectionRules.CatalogViolations(
            RepositoryFiles.ModuleNamesInDirectory(RepositoryFiles.ModulesDirectory), Assemblies.ModuleCatalog));
    }

    [Fact]
    public void ModuleProjectsInSolution_MatchTheCatalog()
    {
        ViolationAssert.None(ArchitectureReflectionRules.CatalogViolations(
            RepositoryFiles.ModuleNamesInSolution(RepositoryFiles.Solution), Assemblies.ModuleCatalog));
    }

    [Fact]
    public void Domain_UsesOnlyAllowedDependencies()
    {
        ViolationAssert.None(ArchitectureDependencyRules.DomainViolations(Assemblies.RealArchitecture.Value));
    }

    /// <summary>An empty rule proves nothing: this fails if the model stops reading the real Domain code.</summary>
    [Theory]
    [InlineData("Sacou.Modules.Matches.Domain.")]
    [InlineData("Sacou.Modules.Identity.Domain.")]
    [InlineData("Sacou.Modules.Groups.Domain.")]
    [InlineData("Sacou.Modules.Stats.Domain.")]
    [InlineData(CourtSessionsNamespace + ".")]
    [InlineData(CourtSessionJsonNamespace + ".")]
    public void RealDomain_IsInspected(string domainNamespace)
    {
        Assert.Contains(
            Assemblies.RealArchitecture.Value.Types,
            type => type.FullName.StartsWith(domainNamespace, StringComparison.Ordinal));
    }

    [Fact]
    public void CourtSessions_DependOnlyOnTheEvents()
    {
        ViolationAssert.None(ArchitectureDependencyRules.DeterministicDomainViolations(
            Assemblies.RealArchitecture.Value, CourtSessionsNamespace));
    }

    [Fact]
    public void CourtSessions_NeverUseTheRemainderOperator()
    {
        ViolationAssert.None(RepositoryFiles.RemainderOperatorViolations(RepositoryFiles.CourtSessionsDirectory));
    }

    [Theory]
    [InlineData(CourtSessionsNamespace)]
    [InlineData(CourtSessionJsonNamespace)]
    public void CourtSessions_HaveNoPersonalDataNames(string namespacePrefix)
    {
        ViolationAssert.None(Assemblies.RealModules.Value.SelectMany(
            module => ArchitectureReflectionRules.PersonalDataNameViolations(module, namespacePrefix)));
    }

    /// <summary>ADR 0051, D12: no event type references the profile, the nickname or a level.</summary>
    [Theory]
    [InlineData(CourtSessionsNamespace)]
    [InlineData(CourtSessionJsonNamespace)]
    public void CourtSessions_NeverReferenceTheProfileOrALevel(string namespacePrefix)
    {
        ViolationAssert.None(ArchitectureDependencyRules.PersonalDataTypeViolations(Assemblies.RealArchitecture.Value, namespacePrefix));
    }

    [Fact]
    public void Domain_HasNoPInvoke()
    {
        ViolationAssert.None(Assemblies.RealModules.Value.SelectMany(ArchitectureReflectionRules.DomainPInvokeViolations));
    }

    [Fact]
    public void DomainFolders_DeclareTheNamespaceOfTheirPath()
    {
        ViolationAssert.None(RepositoryFiles.DomainFolderViolations(RepositoryFiles.ModulesDirectory));
    }

    [Fact]
    public void Modules_UseEachOtherOnlyThroughContracts()
    {
        ViolationAssert.None(ArchitectureDependencyRules.ModuleBoundaryViolations(Assemblies.RealArchitecture.Value));
    }

    [Fact]
    public void Modules_ExposeOnlyContractsAndEntryClass()
    {
        ViolationAssert.None(Assemblies.RealModules.Value.SelectMany(ArchitectureReflectionRules.PublicSurfaceViolations));
    }

    [Fact]
    public void ModulesAndShared_ShareInternalsOnlyWithOwnTests()
    {
        ViolationAssert.None(Assemblies.ModulesAndShared.Value.SelectMany(ArchitectureReflectionRules.InternalsVisibleToViolations));
    }

    [Fact]
    public void ModulesAndShared_DeclareTypesUnderTheirAssemblyName()
    {
        ViolationAssert.None(Assemblies.ModulesAndShared.Value.SelectMany(ArchitectureReflectionRules.NamespaceViolations));
    }

    [Fact]
    public void Shared_ExposesOnlyTheClosedNamespaceList()
    {
        ViolationAssert.None(ArchitectureReflectionRules.SharedNamespaceViolations(Assemblies.Shared, SharedPublicNamespaces));
    }

    [Fact]
    public void Shared_ReferencesOnlyTheClosedAssemblyList()
    {
        ViolationAssert.None(ArchitectureReflectionRules.SharedReferenceViolations(Assemblies.Shared));
    }

    [Fact]
    public void SharedProject_HasNoDependencies()
    {
        ViolationAssert.None(RepositoryFiles.ProjectDependencyViolations(RepositoryFiles.SharedProject));
    }

    /// <summary>Sacou.Http stays below the modules: it never knows one, nor the API (ADR 0039).</summary>
    [Fact]
    public void Http_ReferencesNoModuleNorTheApi()
    {
        ViolationAssert.None(ArchitectureReflectionRules.HttpReferenceViolations(Assemblies.Http));
    }

    [Fact]
    public void Http_ExposesOnlyItsOwnNamespace()
    {
        ViolationAssert.None(ArchitectureReflectionRules.SharedNamespaceViolations(Assemblies.Http, HttpPublicNamespaces));
    }

    /// <summary>The control for the rule above: the real Http project is found and really exposes types.</summary>
    [Fact]
    public void Http_IsInspected()
    {
        Assert.NotEmpty(Assemblies.Http.GetExportedTypes());
    }
}
