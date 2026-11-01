using System.Xml.Linq;
using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>The integration setup rules on the real files, then on planted violations (an untested rule proves nothing).</summary>
public sealed class IntegrationSetupTests
{
    private const string Digest = "3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81";
    private const string OtherDigest = "7c1a8a9a47c780ed0f983770a662f80deb115d95cce3e2daa3d12115b8cd28f0";
    private const string Image = "postgres:18.6@sha256:" + Digest;

    private static readonly string[] CiRelativePath = [".github", "workflows", "ci.yml"];
    private static readonly string[] ComposeRelativePath = ["docker-compose.yml"];

    private static readonly string ValidWorkflow = """
        - name: Test API integration
          run: dotnet test --project apps/api/tests/Sacou.Integration.Tests
        - name: Check Postgres compose
          run: |
            docker compose --env-file .env.example up -d --wait
            docker compose --env-file .env.example exec -T postgres pg_isready -h 127.0.0.1
            docker compose --env-file .env.example down -v
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
    public void IntegrationProject_IsOutsideTheSolution()
    {
        ViolationAssert.None(IntegrationSetupRules.SolutionViolations(RepositoryFiles.Solution));
    }

    [Fact]
    public void IntegrationProject_NeverSkipsAndNeverReadsTheEnvironment()
    {
        var violations = Directory.GetFiles(RepositoryFiles.IntegrationProjectDirectory, "*.cs", SearchOption.AllDirectories)
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .SelectMany(path => IntegrationSetupRules.SourceViolations(Path.GetFileName(path), File.ReadAllText(path)));

        ViolationAssert.None(violations);
    }

    [Fact]
    public void Testcontainers_HasAnExactVersion()
    {
        ViolationAssert.None(IntegrationSetupRules.PackageVersionViolations(
            XDocument.Parse(RepositoryFiles.ReadRepositoryFile("Directory.Packages.props"))));
    }

    [Fact]
    public void AuditScript_CoversTheIntegrationProject()
    {
        ViolationAssert.None(IntegrationSetupRules.AuditViolations(RepositoryFiles.ReadRepositoryFile("package.json")));
    }

    [Fact]
    public void Ci_WithBothSteps_IsNotReported()
    {
        Assert.Empty(IntegrationSetupRules.CiViolations(ValidWorkflow));
    }

    [Theory]
    [InlineData("- name: Test API integration", "- name: Test API")]
    [InlineData("- name: Check Postgres compose", "- name: Check compose")]
    [InlineData("up -d --wait", "up -d")]
    [InlineData("pg_isready -h 127.0.0.1", "pg_isready")]
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
    public void Ci_WithAForbiddenFragment_IsReported(string forbidden)
    {
        Assert.NotEmpty(IntegrationSetupRules.CiViolations($"{ValidWorkflow}{Environment.NewLine}{forbidden}"));
    }

    [Fact]
    public void Images_WithDifferentDigests_AreReported()
    {
        var violations = IntegrationSetupRules.ImageViolations(
            $"\"{Image}\"", $"image: postgres:18.6@sha256:{OtherDigest}");

        Assert.Single(violations);
    }

    [Fact]
    public void Image_WithoutDigest_IsReported()
    {
        var violations = IntegrationSetupRules.ImageViolations("\"postgres:18.6\"", $"image: {Image}");

        Assert.Single(violations);
    }

    [Fact]
    public void Images_WithTheSameDigest_AreNotReported()
    {
        Assert.Empty(IntegrationSetupRules.ImageViolations($"\"{Image}\"", $"image: {Image}"));
    }

    [Fact]
    public void Solution_ListingTheIntegrationProject_IsReported()
    {
        var solution = XDocument.Parse(
            """<Solution><Project Path="apps/api/tests/Sacou.Integration.Tests/Sacou.Integration.Tests.csproj" /></Solution>""");

        Assert.Single(IntegrationSetupRules.SolutionViolations(solution));
    }

    [Theory]
    [InlineData("Assert.Skip(\"no docker\");")]
    [InlineData("[Fact(Skip = \"no docker\")]")]
    [InlineData("Environment.GetEnvironmentVariable(\"X\")")]
    public void Source_WithASkipOrAnEnvironmentRead_IsReported(string source)
    {
        Assert.NotEmpty(IntegrationSetupRules.SourceViolations("Sample.cs", source));
    }

    [Theory]
    [InlineData("""<Project><ItemGroup><PackageVersion Include="Testcontainers.PostgreSql" Version="4.16.0" /></ItemGroup></Project>""")]
    [InlineData("""<Project><ItemGroup><PackageVersion Include="Testcontainers.PostgreSql" Version="4.*" /></ItemGroup></Project>""")]
    [InlineData("""<Project><ItemGroup><PackageVersion Include="Testcontainers.PostgreSql" Version="[4.16.0,)" /></ItemGroup></Project>""")]
    [InlineData("<Project />")]
    public void Testcontainers_WithAFloatingOrMissingVersion_IsReported(string packages)
    {
        Assert.Single(IntegrationSetupRules.PackageVersionViolations(XDocument.Parse(packages)));
    }

    [Fact]
    public void AuditScript_WithoutTheIntegrationProject_IsReported()
    {
        var packageJson = """{ "scripts": { "audit:api": "dotnet list Sacou.slnx package" } }""";

        Assert.Single(IntegrationSetupRules.AuditViolations(packageJson));
    }
}
