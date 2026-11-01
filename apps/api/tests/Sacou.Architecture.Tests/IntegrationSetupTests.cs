using System.Xml.Linq;
using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>The integration setup rules on the real files, then on planted violations (an untested rule proves nothing).</summary>
public sealed class IntegrationSetupTests
{
    private const string Digest = "3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81";
    private const string OtherDigest = "7c1a8a9a47c780ed0f983770a662f80deb115d95cce3e2daa3d12115b8cd28f0";
    private const string Image = "postgres:18.6@sha256:" + Digest;
    private const string ProjectPath = "apps/api/tests/Sacou.Integration.Tests/Sacou.Integration.Tests.csproj";

    private static readonly string[] CiRelativePath = [".github", "workflows", "ci.yml"];
    private static readonly string[] ComposeRelativePath = ["docker-compose.yml"];

    private static readonly string ValidWorkflow = $"""
        - name: Test API integration
          run: dotnet test --project apps/api/tests/Sacou.Integration.Tests
        - name: Check Ryuk image digest
          run: docker image ls --digests --no-trunc | grep 'testcontainers/ryuk' | grep '{IntegrationSetupRules.RyukDigest}'
        - name: Check Postgres compose
          run: |
            docker compose --env-file .env.example up -d --wait
            docker compose --env-file .env.example exec -T postgres pg_isready -h 127.0.0.1
            docker compose --env-file .env.example port postgres 5432 | grep '127.0.0.1:5432'
            docker compose --env-file .env.example down -v
        """;

    private static readonly string ValidTestSource = $$"""
        internal const string Image = "{{Image}}";
        container = new PostgreSqlBuilder(Image).Build();
        """;

    private static readonly string ValidCompose = $"""
        # {Image}
        services:
          postgres:
            image: {Image}
            ports:
              - "127.0.0.1:5432:5432"
        """;

    [Fact]
    public void Ci_RunsTheIntegrationTestsAndTheComposeCheck()
    {
        ViolationAssert.None(IntegrationSetupRules.CiViolations(RepositoryFiles.ReadRepositoryFile(CiRelativePath)));
    }

    [Fact]
    public void TestCodeAndCompose_UseTheSamePinnedImage()
    {
        var testSource = File.ReadAllText(Path.Combine(RepositoryFiles.IntegrationProjectDirectory, "IntegrationDatabase.cs"));

        ViolationAssert.None(IntegrationSetupRules.ImageViolations(
            testSource, RepositoryFiles.ReadRepositoryFile(ComposeRelativePath)));
    }

    [Fact]
    public void Compose_PublishesThePortOnLoopbackOnly()
    {
        ViolationAssert.None(IntegrationSetupRules.ComposeViolations(RepositoryFiles.ReadRepositoryFile(ComposeRelativePath)));
    }

    [Fact]
    public void IntegrationProject_IsOutsideTheSolution()
    {
        ViolationAssert.None(IntegrationSetupRules.SolutionViolations(RepositoryFiles.Solution));
    }

    [Fact]
    public void IntegrationProject_NeverSkipsNeverReadsTheEnvironmentAndKeepsRyuk()
    {
        var directory = RepositoryFiles.IntegrationProjectDirectory;
        var violations = Directory.GetFiles(directory, "*.cs", SearchOption.AllDirectories)
            .Where(path => !IsGenerated(path))
            .Append(Path.Combine(directory, "Sacou.Integration.Tests.csproj"))
            .SelectMany(path => IntegrationSetupRules.SourceViolations(Path.GetFileName(path), File.ReadAllText(path)));

        ViolationAssert.None(violations);
    }

    [Fact]
    public void Testcontainers_HaveExactVersions()
    {
        ViolationAssert.None(IntegrationSetupRules.PackageVersionViolations(
            XDocument.Parse(RepositoryFiles.ReadRepositoryFile("Directory.Packages.props"))));
    }

    [Fact]
    public void IntegrationProject_DoesNotOverrideTheCentralVersions()
    {
        var project = Path.Combine(RepositoryFiles.IntegrationProjectDirectory, "Sacou.Integration.Tests.csproj");

        ViolationAssert.None(IntegrationSetupRules.ProjectVersionViolations(XDocument.Load(project)));
    }

    [Fact]
    public void AuditScript_CoversTheIntegrationProject()
    {
        ViolationAssert.None(IntegrationSetupRules.AuditViolations(RepositoryFiles.ReadRepositoryFile("package.json")));
    }

    [Fact]
    public void Ci_WithAllSteps_IsNotReported()
    {
        Assert.Empty(IntegrationSetupRules.CiViolations(ValidWorkflow));
    }

    [Theory]
    [InlineData("- name: Test API integration", "- name: Test API")]
    [InlineData("dotnet test --project apps/api/tests/Sacou.Integration.Tests", "dotnet test")]
    [InlineData("- name: Check Postgres compose", "- name: Check compose")]
    [InlineData("up -d --wait", "up -d")]
    [InlineData("pg_isready -h 127.0.0.1", "pg_isready")]
    [InlineData("port postgres 5432", "ps")]
    [InlineData("grep '127.0.0.1:5432'", "grep 'x'")]
    [InlineData("down -v", "down")]
    [InlineData("docker image ls --digests", "docker image ls")]
    [InlineData(IntegrationSetupRules.RyukDigest, "sha256:0")]
    public void Ci_WithoutARequiredFragment_IsReported(string required, string replacement)
    {
        var workflow = ValidWorkflow.Replace(required, replacement, StringComparison.Ordinal);

        Assert.NotEmpty(IntegrationSetupRules.CiViolations(workflow));
    }

    [Theory]
    [InlineData("TESTCONTAINERS_RYUK_DISABLED: true")]
    [InlineData("TESTCONTAINERS_RYUK_CONTAINER_IMAGE: other")]
    [InlineData("--ignore-exit-code 8")]
    [InlineData("continue-on-error: true")]
    [InlineData("run: dotnet test || true")]
    [InlineData("if: false")]
    public void Ci_WithAForbiddenFragment_IsReported(string forbidden)
    {
        Assert.NotEmpty(IntegrationSetupRules.CiViolations($"{ValidWorkflow}{Environment.NewLine}{forbidden}"));
    }

    [Fact]
    public void Ci_WithTheRequiredStepOnlyInAComment_IsReported()
    {
        var commented = string.Join(
            '\n', ValidWorkflow.Split('\n').Select(line => $"# {line}"));

        Assert.NotEmpty(IntegrationSetupRules.CiViolations(commented));
    }

    [Fact]
    public void Ci_WithAForbiddenFragmentOnlyInAComment_IsNotReported()
    {
        Assert.Empty(IntegrationSetupRules.CiViolations($"{ValidWorkflow}\n# TESTCONTAINERS_RYUK_DISABLED is forbidden"));
    }

    [Fact]
    public void Images_Equal_AreNotReported()
    {
        Assert.Empty(IntegrationSetupRules.ImageViolations(ValidTestSource, ValidCompose));
    }

    [Fact]
    public void Images_WithDifferentDigests_AreReported()
    {
        var compose = ValidCompose.Replace(Digest, OtherDigest, StringComparison.Ordinal);

        Assert.Single(IntegrationSetupRules.ImageViolations(ValidTestSource, compose));
    }

    [Fact]
    public void Compose_WithLatestImageAndDigestOnlyInAComment_IsReported()
    {
        var compose = ValidCompose.Replace($"image: {Image}", "image: postgres:latest", StringComparison.Ordinal);

        Assert.NotEmpty(IntegrationSetupRules.ImageViolations(ValidTestSource, compose));
    }

    [Fact]
    public void Compose_WithTwoImageLines_IsReported()
    {
        var compose = $"{ValidCompose}\n    image: {Image}";

        Assert.NotEmpty(IntegrationSetupRules.ImageViolations(ValidTestSource, compose));
    }

    [Theory]
    [InlineData("new PostgreSqlBuilder(Image)", "new PostgreSqlBuilder(\"postgres:latest\")")]
    [InlineData("new PostgreSqlBuilder(Image)", "new PostgreSqlBuilder()")]
    [InlineData("new PostgreSqlBuilder(Image)", "new PostgreSqlBuilder(OtherImage)")]
    public void TestSource_WithAnotherBuilderArgument_IsReported(string original, string replacement)
    {
        var source = ValidTestSource.Replace(original, replacement, StringComparison.Ordinal);

        Assert.NotEmpty(IntegrationSetupRules.ImageViolations(source, ValidCompose));
    }

    [Fact]
    public void TestSource_WithTheImageConstantNotPinned_IsReported()
    {
        var source = ValidTestSource.Replace($"@sha256:{Digest}", string.Empty, StringComparison.Ordinal);

        Assert.NotEmpty(IntegrationSetupRules.ImageViolations(source, ValidCompose));
    }

    [Fact]
    public void Compose_WithTheDefaultInterface_IsReported()
    {
        var compose = ValidCompose.Replace("127.0.0.1:5432:5432", "5432:5432", StringComparison.Ordinal);

        Assert.Single(IntegrationSetupRules.ComposeViolations(compose));
    }

    [Fact]
    public void Solution_ListingTheIntegrationProject_IsReported()
    {
        var solution = XDocument.Parse($"""<Solution><Project Path="{ProjectPath}" /></Solution>""");

        Assert.Single(IntegrationSetupRules.SolutionViolations(solution));
    }

    [Theory]
    [InlineData("Assert.Skip(\"no docker\");")]
    [InlineData("[Fact(Skip = \"no docker\")]")]
    [InlineData("[Fact(SkipExceptions = [typeof(InvalidOperationException)])]")]
    [InlineData("[Fact(Explicit = true)]")]
    [InlineData("throw SkipException.ForSkip(\"no docker\");")]
    [InlineData("Environment.GetEnvironmentVariable(\"X\")")]
    [InlineData("TestcontainersSettings.ResourceReaperEnabled = false;")]
    [InlineData("builder.WithCleanUp(false);")]
    [InlineData("<PropertyGroup><Env>TESTCONTAINERS_RYUK_DISABLED</Env></PropertyGroup>")]
    public void Source_WithAForbiddenConstruct_IsReported(string source)
    {
        Assert.NotEmpty(IntegrationSetupRules.SourceViolations("Sample.cs", source));
    }

    [Fact]
    public void Source_WithoutForbiddenConstructs_IsNotReported()
    {
        Assert.Empty(IntegrationSetupRules.SourceViolations("Sample.cs", ValidTestSource));
    }

    [Theory]
    [InlineData("""<Project><ItemGroup><PackageVersion Include="Testcontainers" Version="[4.16.0]" /><PackageVersion Include="Testcontainers.PostgreSql" Version="4.16.0" /></ItemGroup></Project>""")]
    [InlineData("""<Project><ItemGroup><PackageVersion Include="Testcontainers" Version="4.*" /><PackageVersion Include="Testcontainers.PostgreSql" Version="[4.16.0]" /></ItemGroup></Project>""")]
    [InlineData("""<Project><ItemGroup><PackageVersion Include="Testcontainers.PostgreSql" Version="[4.16.0]" /></ItemGroup></Project>""")]
    [InlineData("<Project />")]
    public void Testcontainers_WithAFloatingOrMissingVersion_IsReported(string packages)
    {
        Assert.NotEmpty(IntegrationSetupRules.PackageVersionViolations(XDocument.Parse(packages)));
    }

    [Theory]
    [InlineData("""<Project><ItemGroup><PackageReference Include="Testcontainers" VersionOverride="4.*" /></ItemGroup></Project>""")]
    [InlineData("""<Project><ItemGroup><PackageReference Include="Testcontainers" Version="4.*" /></ItemGroup></Project>""")]
    public void IntegrationProject_WithAVersionOnTheReference_IsReported(string project)
    {
        Assert.Single(IntegrationSetupRules.ProjectVersionViolations(XDocument.Parse(project)));
    }

    [Theory]
    [InlineData("dotnet list Sacou.slnx package --vulnerable")]
    [InlineData($"dotnet restore {ProjectPath}")]
    [InlineData($"dotnet list {ProjectPath} package > .nuget-audit-integration.json && node scripts/check-dotnet-audit.mjs .nuget-audit-integration.json")]
    [InlineData($"dotnet list {ProjectPath} package --vulnerable > .nuget-audit-integration.json")]
    public void AuditScript_WithoutTheIntegrationAudit_IsReported(string script)
    {
        var packageJson = $$"""{ "scripts": { "audit:api": "{{script}}" } }""";

        Assert.NotEmpty(IntegrationSetupRules.AuditViolations(packageJson));
    }

    [Fact]
    public void AuditScript_WithTheIntegrationAudit_IsNotReported()
    {
        var script = $"dotnet list {ProjectPath} package --vulnerable --include-transitive > .nuget-audit-integration.json && node scripts/check-dotnet-audit.mjs .nuget-audit-integration.json";
        var packageJson = $$"""{ "scripts": { "audit:api": "{{script}}" } }""";

        Assert.Empty(IntegrationSetupRules.AuditViolations(packageJson));
    }

    private static bool IsGenerated(string path) =>
        path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
        || path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal);
}
