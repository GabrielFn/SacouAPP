using Sacou.Modules.Identity.Domain.Users;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Domain;

public sealed class AuthSubjectTests
{
    [Theory]
    [InlineData("a")]
    [InlineData("Uid0123456789abcdefXYZ")]
    [InlineData("!~")]
    public void VisibleAscii_IsAccepted(string value)
    {
        var subject = AuthSubject.Create(value);

        Assert.True(subject.IsSuccess);
        Assert.Equal(value, subject.Value.Value);
    }

    [Fact]
    public void ExactlyTheLimit_IsAccepted()
    {
        Assert.True(AuthSubject.Create(new string('x', AuthSubject.MaxLength)).IsSuccess);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("with space")]
    [InlineData("tab\t")]
    [InlineData("control\u0001")]
    [InlineData("delete\u007f")]
    [InlineData("não")]
    public void InvalidValue_FailsWithTheStableCode(string? value)
    {
        var subject = AuthSubject.Create(value);

        Assert.True(subject.IsFailure);
        Assert.Equal("identity.subject-invalid", subject.Error.Code);
    }

    [Fact]
    public void OverTheLimit_Fails()
    {
        Assert.True(AuthSubject.Create(new string('x', AuthSubject.MaxLength + 1)).IsFailure);
    }

    [Fact]
    public void CaseMatters()
    {
        Assert.NotEqual(AuthSubject.Create("abcDEF").Value, AuthSubject.Create("abcdef").Value);
    }

    [Fact]
    public void ToString_NeverShowsTheUid()
    {
        Assert.DoesNotContain("secret-uid", AuthSubject.Create("secret-uid").Value.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void NewUser_HasAVersion7IdFromTheGivenClock()
    {
        var now = new DateTimeOffset(2026, 11, 8, 12, 0, 0, TimeSpan.Zero);

        var user = User.Create(AuthSubject.Create("uid").Value, now);

        Assert.Equal(7, user.Id.Value.Version);
        Assert.Equal(now, user.CreatedAt);
    }
}
