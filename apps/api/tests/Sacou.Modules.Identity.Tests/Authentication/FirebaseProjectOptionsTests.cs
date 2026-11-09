using Sacou.Modules.Identity.Authentication;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Authentication;

public sealed class FirebaseProjectOptionsTests
{
    [Theory]
    [InlineData("sacou-79493")]
    [InlineData("sacou-test-project")]
    [InlineData("abcdef")]
    public void GoogleCloudProjectId_IsValid(string projectId)
    {
        Assert.True(FirebaseProjectOptions.IsValidProjectId(projectId));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Sacou")]
    [InlineData("ab")]
    [InlineData("with_underscore")]
    [InlineData("1starts-with-digit")]
    [InlineData("ends-with-hyphen-")]
    [InlineData("SET-THE-PROJECT-ID")]
    [InlineData("a-project-id-that-is-far-too-long")]
    public void AnythingElse_IsInvalid(string? projectId)
    {
        Assert.False(FirebaseProjectOptions.IsValidProjectId(projectId));
    }

    [Fact]
    public void Issuer_IsTheSecureTokenUrlOfTheProject()
    {
        Assert.Equal("https://securetoken.google.com/sacou-79493", new FirebaseProjectOptions { ProjectId = "sacou-79493" }.Issuer);
    }

    [Fact]
    public void InvalidMessage_NamesTheKey()
    {
        Assert.StartsWith("Firebase:ProjectId ", FirebaseProjectOptions.InvalidProjectIdMessage, StringComparison.Ordinal);
    }
}
