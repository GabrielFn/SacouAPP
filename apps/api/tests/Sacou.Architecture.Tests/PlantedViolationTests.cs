using System.Xml.Linq;
using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>
/// An empty rule proves nothing: the real Domain folders do not exist yet. These tests run the same
/// rules against Sacou.Architecture.Fixtures, where each violation is planted in a type of its own.
/// </summary>
public sealed class PlantedViolationTests
{
    private const string DomainNamespace = "Sacou.Modules.Alpha.Domain.";
    private const string BoundaryNamespace = "Sacou.Modules.Alpha.Boundary.";
    private const int ManyViolations = 200;

    private static readonly Lazy<IReadOnlyList<Violation>> DomainViolations = new(
        () => ArchitectureDependencyRules.DomainViolations(Assemblies.FixturesArchitecture.Value));

    private static readonly Lazy<HashSet<string>> BoundaryViolators = new(
        () => ArchitectureDependencyRules.ModuleBoundaryViolations(Assemblies.FixturesArchitecture.Value)
            .Select(violation => violation.DeclaringType)
            .ToHashSet());

    [Theory]
    [InlineData("HttpInSignature", "Microsoft.AspNetCore.Http.HttpContext")]
    [InlineData("HttpInField", "Microsoft.AspNetCore.Http.HttpContext")]
    [InlineData("HttpInBaseType", "Microsoft.AspNetCore.Http.Endpoint")]
    [InlineData("HttpInGenericArgumentOfSignature", "Microsoft.AspNetCore.Http.HttpContext")]
    [InlineData("HttpInGenericArgumentOfCall", "Microsoft.AspNetCore.Http.HttpContext")]
    [InlineData("HttpInAttribute", "Microsoft.AspNetCore.Authorization.AuthorizeAttribute")]
    [InlineData("HttpInMethodBody", "Microsoft.AspNetCore.Http.DefaultHttpContext")]
    [InlineData("HttpInLambda", "Microsoft.AspNetCore.Http.DefaultHttpContext")]
    [InlineData("HttpInAsyncMethod", "Microsoft.AspNetCore.Http.DefaultHttpContext")]
    [InlineData("HttpInIterator", "Microsoft.AspNetCore.Http.DefaultHttpContext")]
    [InlineData("LoggingOutsideAnyBlockList", "Microsoft.Extensions.Logging.ILogger")]
    [InlineData("NetHttpClient", "System.Net.Http.HttpClient")]
    [InlineData("SystemData", "System.Data.DataTable")]
    [InlineData("FileAccess", "System.IO.File")]
    [InlineData("EnvironmentAccess", "System.Environment")]
    [InlineData("EnvironmentNestedType", "System.Environment+SpecialFolder")]
    [InlineData("ConsoleAccess", "System.Console")]
    [InlineData("AppContextAccess", "System.AppContext")]
    [InlineData("AppDomainAccess", "System.AppDomain")]
    [InlineData("ActivatorAccess", "System.Activator")]
    [InlineData("GcAccess", "System.GC")]
    [InlineData("ProcessAccess", "System.Diagnostics.Process")]
    [InlineData("StopwatchAccess", "System.Diagnostics.Stopwatch")]
    [InlineData("MarshalAccess", "System.Runtime.InteropServices.Marshal")]
    [InlineData("NativeLibraryAccess", "System.Runtime.InteropServices.NativeLibrary")]
    public void Domain_WithForbiddenDependency_IsReportedForThatDependency(string type, string dependency)
    {
        var details = DomainViolations.Value
            .Where(violation => violation.DeclaringType == DomainNamespace + type)
            .Select(violation => violation.Detail);

        Assert.Contains(details, detail => detail.Contains(dependency, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("Sacou.Modules.Alpha.Domain.PInvokeInStaticMethod.GetTickCount")]
    [InlineData("Sacou.Modules.Alpha.Domain.PInvokeInNestedType+Native.GetTickCount")]
    [InlineData("Sacou.Modules.Alpha.Foo.Domain.PInvokeInNestedDomain.GetTickCount")]
    public void Domain_WithPInvoke_IsReported(string method)
    {
        Assert.Contains(method, ArchitectureReflectionRules.DomainPInvokeViolations(Assemblies.Fixtures));
    }

    [Fact]
    public void PInvokeRule_ReportsOnlyTheDomain()
    {
        Assert.DoesNotContain(
            ArchitectureReflectionRules.DomainPInvokeViolations(Assemblies.Fixtures),
            violation => violation.Contains("PInvokeOutsideDomain", StringComparison.Ordinal));
    }

    /// <summary>Documents why the P/Invoke rule exists: if this ever fails, the IL rule learned to see it.</summary>
    [Theory]
    [InlineData("Sacou.Modules.Alpha.Domain.PInvokeInStaticMethod")]
    [InlineData("Sacou.Modules.Alpha.Domain.PInvokeInNestedType")]
    [InlineData("Sacou.Modules.Alpha.Foo.Domain.PInvokeInNestedDomain")]
    public void DependencyRule_DoesNotSeeDllImport(string type)
    {
        Assert.DoesNotContain(DomainViolations.Value, violation => violation.DeclaringType == type);
    }

    [Fact]
    public void NestedDomain_WithForbiddenDependency_IsReported()
    {
        Assert.Contains(
            DomainViolations.Value,
            violation => violation.DeclaringType == "Sacou.Modules.Alpha.Foo.Domain.NestedDomainUsingHttpClient"
                && violation.Detail.Contains("System.Net.Http.HttpClient", StringComparison.Ordinal));
    }

    [Fact]
    public void NestedDomain_WithAllowedDependency_IsNotReported()
    {
        Assert.DoesNotContain(
            DomainViolations.Value,
            violation => violation.DeclaringType == "Sacou.Modules.Alpha.Foo.Domain.AllowedNestedDomain");
    }

    [Fact]
    public void NameThatOnlyStartsWithDomain_IsNotTreatedAsDomain()
    {
        Assert.DoesNotContain(
            DomainViolations.Value,
            violation => violation.DeclaringType == "Sacou.Modules.Alpha.DomainEvents.NotInDomain");
    }

    [Theory]
    [InlineData("Sessions/Domain/Wrong.cs", "namespace Sacou.Modules.Sessions.Core;")]
    [InlineData("Sessions/Foo/Domain/Wrong.cs", "namespace Sacou.Modules.Sessions.Foo.Core;")]
    [InlineData("Sessions/Domain/Sub/Wrong.cs", "namespace Sacou.Modules.Sessions.Domain;")]
    [InlineData("Sessions/Domain/Wrong.cs", "namespace Foo.Domain\n{\n}")]
    [InlineData("Sessions/Domain/NoNamespace.cs", "internal static class NoNamespace;")]
    [InlineData("Sessions/Domain/Second.cs", "namespace Sacou.Modules.Sessions.Domain\n{\n}\nnamespace Sacou.Modules.Sessions.Core\n{\n}")]
    public void DomainFolder_WithNamespaceOtherThanItsPath_IsReported(string file, string source)
    {
        Assert.Single(DomainFolderViolationsOf(file, source));
    }

    [Theory]
    [InlineData("Sessions/Domain/Right.cs", "namespace Sacou.Modules.Sessions.Domain;")]
    [InlineData("Sessions/Foo/Domain/Right.cs", "namespace Sacou.Modules.Sessions.Foo.Domain;")]
    [InlineData("Sessions/Domain/Sub/Right.cs", "namespace Sacou.Modules.Sessions.Domain.Sub;")]
    [InlineData("Sessions/Slice/Handler.cs", "namespace Whatever;")]
    [InlineData("Sessions/obj/Domain/Generated.cs", "namespace Whatever;")]
    public void DomainFolder_WithNamespaceOfItsPath_IsNotReported(string file, string source)
    {
        Assert.Empty(DomainFolderViolationsOf(file, source));
    }

    [Theory]
    [InlineData("AllowedBclAndShared")]
    [InlineData("AllowedGeneric`1")]
    [InlineData("AllowedSameDomainDependency")]
    [InlineData("AllowedRecord")]
    [InlineData("AllowedRecordStruct")]
    [InlineData("AllowedClosedHierarchy")]
    [InlineData("AllowedCollectionExpressions")]
    public void Domain_WithAllowedDependency_IsNotReported(string type)
    {
        Assert.DoesNotContain(DomainViolations.Value, violation => violation.DeclaringType == DomainNamespace + type);
    }

    [Theory]
    [InlineData("UsesBetaDomain")]
    [InlineData("UsesBetaModule")]
    [InlineData("UsesApi")]
    public void Module_CrossingTheBoundary_IsReported(string type)
    {
        Assert.Contains(BoundaryNamespace + type, BoundaryViolators.Value);
    }

    [Fact]
    public void Module_UsingOtherModuleContracts_IsNotReported()
    {
        Assert.DoesNotContain(BoundaryNamespace + "AllowedUsesBetaContracts", BoundaryViolators.Value);
    }

    [Fact]
    public void PublicSurface_ReportsOnlyTypesOutsideContractsAndEntryClass()
    {
        var violations = ArchitectureReflectionRules.PublicSurfaceViolations(Assemblies.Fixtures);

        Assert.Equal(
            ["Sacou.Modules.Surface.ContractsLookalike.PublicLookalikeLeak", "Sacou.Modules.Surface.PublicLeak"],
            violations.Order());
    }

    [Fact]
    public void InternalsVisibleTo_ReportsOnlyOtherAssemblies()
    {
        var violations = ArchitectureReflectionRules.InternalsVisibleToViolations(Assemblies.Fixtures);

        Assert.Equal(["Sacou.Modules.Beta"], violations);
    }

    [Fact]
    public void Catalog_WithMissingModule_IsReported()
    {
        var violations = ArchitectureReflectionRules.CatalogViolations(
            Assemblies.ModuleCatalog.Skip(1), Assemblies.ModuleCatalog);

        Assert.Equal([$"Missing module: {Assemblies.ModuleCatalog[0]}"], violations);
    }

    [Fact]
    public void Catalog_WithExtraModule_IsReported()
    {
        var violations = ArchitectureReflectionRules.CatalogViolations(
            [.. Assemblies.ModuleCatalog, "Sacou.Modules.Foo"], Assemblies.ModuleCatalog);

        Assert.Equal(["Module outside the catalog: Sacou.Modules.Foo"], violations);
    }

    [Fact]
    public void Shared_WithNewPublicNamespace_IsReported()
    {
        var violations = ArchitectureReflectionRules.SharedNamespaceViolations(
            Assemblies.Fixtures, ["Sacou.Modules.Surface"]);

        Assert.Contains("Sacou.Modules.Surface.Contracts", violations);
    }

    [Theory]
    [InlineData("Sacou.Modules.Groups")]
    [InlineData("Microsoft.AspNetCore.Http.Abstractions")]
    public void Shared_ReferencingModuleOrAspNet_IsReported(string assembly)
    {
        Assert.Contains(assembly, ArchitectureReflectionRules.SharedReferenceViolations(Assemblies.Fixtures));
    }

    [Theory]
    [InlineData("System.Net.Http")]
    [InlineData("System.Data.Common")]
    [InlineData("System.Reactive")]
    public void Shared_ReferencingSystemNamedAssemblyOutsideTheList_IsReported(string assembly)
    {
        Assert.Equal([assembly], ArchitectureReflectionRules.SharedReferenceViolations([assembly]));
    }

    [Theory]
    [InlineData("""<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="Foo" /></ItemGroup></Project>""", "PackageReference: Foo")]
    [InlineData("""<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><FrameworkReference Include="Foo" /></ItemGroup></Project>""", "FrameworkReference: Foo")]
    [InlineData("""<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><ProjectReference Include="Foo" /></ItemGroup></Project>""", "ProjectReference: Foo")]
    [InlineData("""<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><Reference Include="Foo" /></ItemGroup></Project>""", "Reference: Foo")]
    [InlineData("""<Project Sdk="Microsoft.NET.Sdk.Web"></Project>""", "SDK: Microsoft.NET.Sdk.Web")]
    public void SharedProject_WithUnusedDependency_IsReported(string project, string violation)
    {
        Assert.Equal([violation], RepositoryFiles.ProjectDependencyViolations(XDocument.Parse(project)));
    }

    [Fact]
    public void SharedProject_WithoutDependencies_IsNotReported()
    {
        var project = XDocument.Parse("""<Project Sdk="Microsoft.NET.Sdk"></Project>""");

        Assert.Empty(RepositoryFiles.ProjectDependencyViolations(project));
    }

    [Fact]
    public void NamespaceOutsideTheAssemblyName_IsReported()
    {
        var violations = ArchitectureReflectionRules.NamespaceViolations(Assemblies.Fixtures);

        Assert.Contains("Foo.Domain.EscapedDomainType", violations);
    }

    [Fact]
    public void NamespaceUnderTheAssemblyName_IsNotReported()
    {
        var violations = ArchitectureReflectionRules.NamespaceViolations(Assemblies.Fixtures);

        Assert.DoesNotContain("Sacou.Architecture.Fixtures.SharedViolations", violations);
    }

    [Fact]
    public void CompilerGeneratedTypes_AreNotReportedForNamespace()
    {
        var violations = ArchitectureReflectionRules.NamespaceViolations(Assemblies.Shared);

        Assert.Empty(violations);
    }

    [Fact]
    public void ModuleProjectInFolder_WithoutApiReference_IsReported()
    {
        var directory = Directory.CreateTempSubdirectory("sacou-modules-");
        try
        {
            var module = directory.CreateSubdirectory("Foo");
            File.WriteAllText(Path.Combine(module.FullName, "Sacou.Modules.Foo.csproj"), string.Empty);

            var violations = ArchitectureReflectionRules.CatalogViolations(
                RepositoryFiles.ModuleNamesInDirectory(directory.FullName), []);

            Assert.Equal(["Module outside the catalog: Sacou.Modules.Foo"], violations);
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }

    [Fact]
    public void ModuleProjectInSolution_OutsideTheCatalog_IsReported()
    {
        var solution = XDocument.Parse(
            """
            <Solution>
                <Project Path="apps/api/src/Sacou.Api/Sacou.Api.csproj" />
                <Project Path="apps/api/src/Sacou.Modules/Foo/Sacou.Modules.Foo.csproj" />
            </Solution>
            """);

        var violations = ArchitectureReflectionRules.CatalogViolations(
            RepositoryFiles.ModuleNamesInSolution(solution), []);

        Assert.Equal(["Module outside the catalog: Sacou.Modules.Foo"], violations);
    }

    [Fact]
    public void ModuleProjectInTestsFolder_IsNotACatalogModule()
    {
        var solution = XDocument.Parse(
            """
            <Solution>
                <Project Path="apps/api/tests/Sacou.Modules.Matches.Tests/Sacou.Modules.Matches.Tests.csproj" />
            </Solution>
            """);

        Assert.Empty(RepositoryFiles.ModuleNamesInSolution(solution));
    }

    [Fact]
    public void ProjectWithTestsSuffixOutsideTheTestsFolder_IsStillAModule()
    {
        var solution = XDocument.Parse(
            """
            <Solution>
                <Project Path="apps/api/src/Sacou.Modules/Foo/Sacou.Modules.Foo.Tests.csproj" />
            </Solution>
            """);

        var violations = ArchitectureReflectionRules.CatalogViolations(
            RepositoryFiles.ModuleNamesInSolution(solution), []);

        Assert.Equal(["Module outside the catalog: Sacou.Modules.Foo.Tests"], violations);
    }

    [Fact]
    public void FailureMessage_ListsEveryViolation()
    {
        var violations = Enumerable.Range(0, ManyViolations).Select(index => $"violation-{index}").ToList();

        var failure = Assert.ThrowsAny<Exception>(() => ViolationAssert.None(violations));

        Assert.All(violations, violation => Assert.Contains(violation, failure.Message, StringComparison.Ordinal));
    }

    [Fact]
    public void NoViolations_DoesNotFail()
    {
        ViolationAssert.None(Array.Empty<string>());
    }

    private static IReadOnlyList<string> DomainFolderViolationsOf(string file, string source)
    {
        var directory = Directory.CreateTempSubdirectory("sacou-domain-");
        try
        {
            var path = Path.Combine(directory.FullName, file);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, source);
            return RepositoryFiles.DomainFolderViolations(directory.FullName);
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }
}
