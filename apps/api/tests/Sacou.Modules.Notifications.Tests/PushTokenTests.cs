using Sacou.Modules.Notifications.Domain;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>U3 of E3.11: the shapes of an Expo push token, and a token that never prints itself.</summary>
public sealed class PushTokenTests
{
    private const string Exponent = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

    [Theory]
    [InlineData(Exponent)]
    [InlineData("ExpoPushToken[abc-DEF_123]")]
    [InlineData("ExponentPushToken[a]")]
    public void WellFormed_IsAccepted(string text) => Assert.Equal(text, PushToken.Parse(text).Value.Value);

    [Fact]
    public void TwoHundredCharacters_IsAccepted()
    {
        var text = Token(PushToken.MaxLength);

        Assert.True(PushToken.Parse(text).IsSuccess);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("ExponentPushToken")]
    [InlineData("ExponentPushToken[]")]
    [InlineData("ExponentPushToken[abc")]
    [InlineData("ExponentPushTokenabc]")]
    [InlineData("exponentpushtoken[abc]")]
    [InlineData("ExponentPushToken[ab c]")]
    [InlineData(" ExponentPushToken[abc]")]
    [InlineData("ExponentPushToken[abc] ")]
    [InlineData("ExponentPushToken[a[b]")]
    [InlineData("ExponentPushToken[a]b]")]
    [InlineData("ExponentPushToken[abc\u0007]")]
    [InlineData("ExponentPushToken[abc\n]")]
    [InlineData("ExponentPushToken[abc\U0001F3D0]")]
    [InlineData("ExponentPushToken[ação]")]
    [InlineData("FcmToken[abc]")]
    public void OutOfShape_IsTokenInvalid(string? text) => Assert.Equal(NotificationErrors.TokenInvalid, PushToken.Parse(text).Error);

    [Fact]
    public void TwoHundredAndOneCharacters_IsTokenInvalid() =>
        Assert.Equal(NotificationErrors.TokenInvalid, PushToken.Parse(Token(PushToken.MaxLength + 1)).Error);

    [Fact]
    public void ToString_NeverPrintsTheToken()
    {
        var token = PushToken.Parse(Exponent).Value;

        Assert.DoesNotContain("xxxx", token.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("xxxx", $"{token}", StringComparison.Ordinal);
    }

    private static string Token(int length)
    {
        const string Prefix = "ExponentPushToken[";
        return Prefix + new string('a', length - Prefix.Length - 1) + "]";
    }
}
