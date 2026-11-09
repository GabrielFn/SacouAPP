using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>G2: the guard on the real source, then on each planted fragment (an untested rule proves nothing).</summary>
public sealed class AuthenticationGuardTests
{
    private const string ValidSource = """
        var parameters = new TokenValidationParameters
        {
            TryAllIssuerSigningKeys = false,
            RequireSignedTokens = true,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
        };
        """;

    [Fact]
    public void ApiSource_KeepsTheTokenCheckStrict()
    {
        ViolationAssert.None(AuthenticationGuardRules.DirectoryViolations(Path.Combine(RepositoryFiles.ApiDirectory, "src")));
    }

    [Fact]
    public void ValidSource_IsNotReported()
    {
        Assert.Empty(AuthenticationGuardRules.SourceViolations("Sample.cs", ValidSource));
    }

    [Theory]
    [InlineData("IdentityModelEventSource.ShowPII = true;")]
    [InlineData("IdentityModelEventSource.LogCompleteSecurityArtifact = true;")]
    [InlineData("options.IncludeErrorDetails = true;")]
    [InlineData("TryAllIssuerSigningKeys = true,")]
    [InlineData("TryAllIssuerSigningKeys=true,")]
    [InlineData("RequireSignedTokens = false,")]
    [InlineData("ValidateIssuer = false,")]
    [InlineData("ValidateAudience = false,")]
    [InlineData("ValidateLifetime  =  false,")]
    [InlineData("SignatureValidator = (token, _) => new JsonWebToken(token),")]
    [InlineData("app.MapGet(\"/open\", () => \"x\").AllowAnonymous();")]
    [InlineData("[AllowAnonymous]")]
    public void PlantedFragment_IsReported(string fragment)
    {
        Assert.NotEmpty(AuthenticationGuardRules.SourceViolations("Sample.cs", $"{ValidSource}\n{fragment}"));
    }

    [Fact]
    public void AllowAnonymousInProgram_IsNotReported()
    {
        Assert.Empty(AuthenticationGuardRules.SourceViolations(
            AuthenticationGuardRules.ProgramFileName, "app.MapHealthChecks(\"/health\").AllowAnonymous();"));
    }

    [Fact]
    public void FragmentOnlyInAComment_IsNotReported()
    {
        Assert.Empty(AuthenticationGuardRules.SourceViolations("Sample.cs", $"{ValidSource}\n// never set ShowPII"));
    }
}
