using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>
/// The JSON files have a single source, in packages/volley-rules. Pix is only read here: its generator
/// has no C# port until E3.10 decides where it runs (ADR 0025). Failure messages name the case, never
/// its content, because a Pix case holds keys and payloads.
/// </summary>
public sealed partial class SharedGoldenFilesTests
{
    private const int PixCaseCount = 64;
    private const int PixCrcCaseCount = 4;
    private const string FractionalAmountCase = "invalid-amount-fractional";
    private const double FractionalAmount = 10.5;
    private const string MatchesAssembly = "Sacou.Modules.Matches";

    private static readonly string[] PixIds =
    [
        "official-static-without-amount",
        "key-cpf",
        "key-cnpj-alphanumeric",
        "key-phone",
        "key-email",
        "key-email-77-characters",
        "key-email-78-characters",
        "invalid-key-cpf-with-punctuation",
        "invalid-key-cpf-10-digits",
        "invalid-key-cpf-12-digits",
        "invalid-key-cpf-empty",
        "invalid-key-cpf-trailing-newline",
        "invalid-key-cpf-non-ascii-digits",
        "invalid-key-cnpj-lowercase",
        "invalid-key-cnpj-13-characters",
        "invalid-key-cnpj-15-characters",
        "invalid-key-phone-without-country-code",
        "invalid-key-phone-other-country-code",
        "invalid-key-phone-10-digits",
        "invalid-key-phone-12-digits",
        "invalid-key-email-non-ascii",
        "invalid-key-email-without-at",
        "invalid-key-email-without-domain-dot",
        "invalid-key-email-with-space",
        "invalid-key-email-two-at-signs",
        "invalid-key-email-trailing-newline",
        "invalid-key-random-uppercase",
        "invalid-key-random-without-hyphens",
        "invalid-key-random-non-hex",
        "invalid-key-random-trailing-newline",
        "amount-1-cent",
        "amount-100-cents",
        "amount-10050-cents",
        "amount-maximum",
        "invalid-amount-zero",
        "invalid-amount-negative",
        "invalid-amount-fractional",
        "invalid-amount-above-maximum",
        "name-diacritics",
        "name-already-decomposed",
        "name-25-characters",
        "name-26-characters-cut",
        "name-25-accented-characters-not-cut",
        "name-cut-on-a-space",
        "name-case-preserved",
        "name-spaces-collapsed-and-trimmed",
        "name-emoji-removed",
        "name-letter-without-decomposition-removed",
        "name-tab-turned-into-space",
        "name-no-break-space-turned-into-space",
        "name-printable-ascii-edges",
        "invalid-name-only-emoji",
        "invalid-name-only-spaces",
        "invalid-name-empty",
        "city-long-with-diacritics",
        "city-cut-on-a-space",
        "city-15-characters",
        "city-16-characters-cut",
        "invalid-city-only-emoji",
        "invalid-city-only-spaces",
        "error-order-key-first",
        "error-order-name-second",
        "error-order-city-third",
        "crc-with-leading-zeros",
    ];

    private static readonly string[] PixCrcIds =
    [
        "check-value-123456789",
        "official-br-code-example",
        "official-pix-static",
        "leading-zeros",
    ];

    private static readonly HashSet<string> PixFields = ["id", "source", "input", "expectedPayload", "expectedError"];
    private static readonly HashSet<string> PixInputFields = ["key", "merchantName", "merchantCity", "amountCents"];
    private static readonly HashSet<string> PixKeyFields = ["type", "value"];
    private static readonly HashSet<string> PixCrcFields = ["id", "source", "ascii", "expectedCrc"];

    private static readonly Lazy<List<JsonElement>> PixCases = new(() => ReadCases("pix.json"));
    private static readonly Lazy<List<JsonElement>> PixCrcCases = new(() => ReadCases("pix-crc.json"));

    public static TheoryData<string> PixCaseIds => new(PixIds);

    public static TheoryData<string> PixCrcCaseIds => new(PixCrcIds);

    public static TheoryData<string> SharedFiles => new(RepositoryFiles.SharedJsonFiles);

    public static TheoryData<string> TestProjects => new(RepositoryFiles.TestProjectFiles());

    [Theory]
    [MemberData(nameof(SharedFiles))]
    public void SharedFile_HasNoRepeatedKey(string relativePath)
    {
        GoldenFile.ParseStrict(RepositoryFiles.ReadRepositoryFile(relativePath.Split('/')));
    }

    [Theory]
    [InlineData("""{ "a": 1, "a": 2 }""")]
    [InlineData("""{ "a": 1, "\u0061": 2 }""")]
    [InlineData("""[{ "b": { "a": 1, "a": 2 } }]""")]
    public void StrictReading_RefusesARepeatedKey(string json)
    {
        Assert.ThrowsAny<JsonException>(() => GoldenFile.ParseStrict(json));
    }

    [Fact]
    public void SharedFiles_AreNotCopiedIntoTheApi()
    {
        ViolationAssert.None(RepositoryFiles.CopiedSharedFileViolations(RepositoryFiles.ApiDirectory));
    }

    [Fact]
    public void SharedFileCopied_IsReported()
    {
        var directory = Directory.CreateTempSubdirectory("sacou-copies-");
        try
        {
            var inSource = directory.CreateSubdirectory("Foo");
            var inOutput = directory.CreateSubdirectory("bin");
            File.WriteAllText(Path.Combine(inSource.FullName, "overlap.json"), "[]");
            File.WriteAllText(Path.Combine(inSource.FullName, "other.json"), "[]");
            File.WriteAllText(Path.Combine(inOutput.FullName, "pix.json"), "[]");

            Assert.Equal(
                [Path.Combine("Foo", "overlap.json")],
                RepositoryFiles.CopiedSharedFileViolations(directory.FullName));
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }

    [Theory]
    [InlineData(MatchesAssembly, RepositoryFiles.CatalogResourceName, RepositoryFiles.CatalogPath)]
    [InlineData(RepositoryFiles.SettingsCatalogAssembly, RepositoryFiles.SettingsCatalogResourceName, RepositoryFiles.SettingsCatalogPath)]
    [InlineData(RepositoryFiles.RatingParamsAssembly, RepositoryFiles.RatingParamsResourceName, RepositoryFiles.RatingParamsPath)]
    public void CatalogResource_IsByteForByteTheSharedFile(string assemblyName, string resourceName, string path)
    {
        var assembly = Assemblies.RealModules.Value.Single(module => module.GetName().Name == assemblyName);
        using var resource = assembly.GetManifestResourceStream(resourceName);
        Assert.NotNull(resource);
        using var bytes = new MemoryStream();
        resource.CopyTo(bytes);

        Assert.Equal(RepositoryFiles.ReadRepositoryBytes(path.Split('/')), bytes.ToArray());
    }

    [Theory]
    [MemberData(nameof(TestProjects))]
    public void TestProject_EmbedsOnlySharedGoldenFiles(string projectFile)
    {
        ViolationAssert.None(RepositoryFiles.TestResourceViolations(XDocument.Load(projectFile)));
    }

    [Theory]
    [InlineData("""<Project><ItemGroup><EmbeddedResource Include="copy/overlap.json" /></ItemGroup></Project>""")]
    [InlineData("""<Project><ItemGroup><EmbeddedResource Include="../../../../packages/volley-rules/src/formations/formations.json" /></ItemGroup></Project>""")]
    [InlineData("""<Project><ItemGroup><EmbeddedResource Include="../../../../packages/rating/src/rating-params.json" /></ItemGroup></Project>""")]
    public void TestProject_EmbeddingAnotherPath_IsReported(string project)
    {
        Assert.Single(RepositoryFiles.TestResourceViolations(XDocument.Parse(project)));
    }

    [Theory]
    [InlineData("../../../../packages/volley-rules/golden/overlap.json")]
    [InlineData("../../../../packages/match-engine/golden/event-log.json")]
    [InlineData("../../../../packages/rating/golden/rating-pools.json")]
    public void TestProject_EmbeddingAGoldenFile_IsNotReported(string path)
    {
        var project = XDocument.Parse(
            $"""<Project><ItemGroup><EmbeddedResource Include="{path}" /></ItemGroup></Project>""");

        Assert.Empty(RepositoryFiles.TestResourceViolations(project));
    }

    [Fact]
    public void ProductionAssemblies_EmbedOnlyTheCatalog()
    {
        ViolationAssert.None(Assemblies.ModulesAndShared.Value.SelectMany(ProductionResourceViolationsOf));
    }

    [Theory]
    [InlineData(MatchesAssembly, "Sacou.Modules.Matches.formations.json", "golden/overlap.json")]
    [InlineData(MatchesAssembly, "golden/overlap.json", "")]
    [InlineData(MatchesAssembly, "", "")]
    [InlineData("Sacou.Modules.Stats", "golden/player-card-level.json", "")]
    [InlineData(RepositoryFiles.RatingParamsAssembly, "", "")]
    [InlineData(RepositoryFiles.RatingParamsAssembly, RepositoryFiles.RatingParamsResourceName, "golden/rating-pools.json")]
    [InlineData(RepositoryFiles.SettingsCatalogAssembly, "", "")]
    [InlineData(RepositoryFiles.SettingsCatalogAssembly, RepositoryFiles.SettingsCatalogResourceName, "golden/settings-resolver.json")]
    public void ProductionAssembly_WithOtherResources_IsReported(string assembly, string first, string second)
    {
        string[] resources = [.. new[] { first, second }.Where(name => name.Length > 0)];

        Assert.NotEmpty(RepositoryFiles.ProductionResourceViolations(assembly, resources));
    }

    [Fact]
    public void PixList_HasTheExactTotal()
    {
        Assert.Equal(PixCaseCount, PixIds.Length);
    }

    [Fact]
    public void PixList_MatchesTheFile()
    {
        GoldenFile.AssertListMatchesFile(PixIds, [.. PixCases.Value.Select(GoldenFile.IdOf)]);
    }

    [Theory]
    [MemberData(nameof(PixCaseIds))]
    public void PixCase_FollowsTheContract(string id)
    {
        var goldenCase = GoldenFile.SingleCase(PixCases.Value, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, PixFields, id);
        GoldenFile.Text(goldenCase, "source");
        var hasPayload = goldenCase.TryGetProperty("expectedPayload", out _);
        var hasError = goldenCase.TryGetProperty("expectedError", out _);
        Assert.True(hasPayload != hasError, $"{id}: expected exactly one of expectedPayload and expectedError.");
        GoldenFile.Text(goldenCase, hasPayload ? "expectedPayload" : "expectedError");

        AssertPixInput(goldenCase.GetProperty("input"), id);
    }

    [Fact]
    public void PixFractionalAmount_IsReadAsADouble()
    {
        var input = GoldenFile.SingleCase(PixCases.Value, GoldenFile.IdOf, FractionalAmountCase).GetProperty("input");

        GoldenFile.AssertExact(
            FractionalAmount,
            GoldenFile.Number(input.GetProperty("amountCents"), FractionalAmountCase),
            FractionalAmountCase);
    }

    [Fact]
    public void PixCrcList_HasTheExactTotal()
    {
        Assert.Equal(PixCrcCaseCount, PixCrcIds.Length);
    }

    [Fact]
    public void PixCrcList_MatchesTheFile()
    {
        GoldenFile.AssertListMatchesFile(PixCrcIds, [.. PixCrcCases.Value.Select(GoldenFile.IdOf)]);
    }

    [Theory]
    [MemberData(nameof(PixCrcCaseIds))]
    public void PixCrcCase_FollowsTheContract(string id)
    {
        var goldenCase = GoldenFile.SingleCase(PixCrcCases.Value, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, PixCrcFields, id);
        GoldenFile.Text(goldenCase, "source");
        GoldenFile.Text(goldenCase, "ascii");

        Assert.True(CrcPattern().IsMatch(GoldenFile.Text(goldenCase, "expectedCrc")), $"{id}: expected 4 uppercase hex digits.");
    }

    [Theory]
    [InlineData("1D3D\n")]
    [InlineData("1d3d")]
    [InlineData("1D3")]
    public void CrcPattern_RefusesWhatIsNotTheFormat(string text)
    {
        Assert.DoesNotMatch(CrcPattern(), text);
    }

    private static IReadOnlyList<string> ProductionResourceViolationsOf(Assembly assembly) =>
        RepositoryFiles.ProductionResourceViolations(assembly.GetName().Name ?? string.Empty, assembly.GetManifestResourceNames());

    private static List<JsonElement> ReadCases(string fileName) =>
        [.. GoldenFile.ParseStrict(RepositoryFiles.ReadRepositoryFile("packages", "volley-rules", "golden", fileName)).EnumerateArray()];

    private static void AssertPixInput(JsonElement input, string id)
    {
        GoldenFile.AssertOnlyFields(input, PixInputFields, id);
        GoldenFile.Text(input, "merchantName");
        GoldenFile.Text(input, "merchantCity");
        var key = input.GetProperty("key");
        GoldenFile.AssertOnlyFields(key, PixKeyFields, id);
        GoldenFile.Text(key, "type");
        GoldenFile.Text(key, "value");
        if (input.TryGetProperty("amountCents", out var amount))
        {
            GoldenFile.Number(amount, id);
        }
    }

    /// <summary>\z and not $, which accepts a trailing newline (pix.md).</summary>
    [GeneratedRegex(@"^[0-9A-F]{4}\z")]
    private static partial Regex CrcPattern();
}
