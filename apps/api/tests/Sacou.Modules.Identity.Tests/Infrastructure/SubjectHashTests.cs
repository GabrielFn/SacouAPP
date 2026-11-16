using System.Security.Cryptography;
using System.Text;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Infrastructure;

/// <summary>U4 of E3.16 (ADR 0056, D5): SHA-256 of the UID in UTF-8, deterministic, 32 bytes, never printed.</summary>
public sealed class SubjectHashTests
{
    private const string Uid = "Uid0123456789abcdefXYZ";

    [Fact]
    public void Hash_IsTheSha256OfTheUtf8Uid()
    {
        var hash = SubjectHash.Of(Subject(Uid)).ToArray();

        Assert.Equal(SubjectHash.Length, hash.Length);
        Assert.Equal(SHA256.HashData(Encoding.UTF8.GetBytes(Uid)), hash);
    }

    [Fact]
    public void SameUid_SameHash_OtherUid_OtherHash()
    {
        Assert.True(SubjectHash.Of(Subject(Uid)).Matches(SubjectHash.Of(Subject(Uid))));
        Assert.False(SubjectHash.Of(Subject(Uid)).Matches(SubjectHash.Of(Subject(Uid + "x"))));
        Assert.False(SubjectHash.Of(Subject(Uid)).Matches(SubjectHash.Of(Subject(Uid.ToUpperInvariant()))));
    }

    [Fact]
    public void ToArray_IsACopy()
    {
        var hash = SubjectHash.Of(Subject(Uid));
        var bytes = hash.ToArray();
        bytes[0] ^= 0xFF;

        Assert.NotEqual(bytes, hash.ToArray());
    }

    [Fact]
    public void ToString_ShowsNothing()
    {
        var hash = SubjectHash.Of(Subject(Uid));

        Assert.Equal("SubjectHash", hash.ToString());
        Assert.DoesNotContain(Convert.ToHexString(hash.ToArray()), $"{hash}", StringComparison.OrdinalIgnoreCase);
    }

    private static AuthSubject Subject(string value) => AuthSubject.Create(value).Value;
}
