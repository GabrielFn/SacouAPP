using Sacou.Modules.Identity.Infrastructure;
using Sacou.Modules.Identity.ReapplyDeletions;
using Xunit;

namespace Sacou.Modules.Identity.Tests.ReapplyDeletions;

/// <summary>E6.3 S2, criterion 12 without a Postgres: a source that does not connect is refused with the code only.</summary>
public sealed class ReapplyDeletionsSourceUnreadableTests
{
    private const string ClosedPort = "Host=127.0.0.1;Port=1;Database=secret_db_name;Username=secret_user;Password=secret_pw;Timeout=3";

    [Fact]
    public async Task SourceThatDoesNotConnect_IsUnreadable_WithoutHostOrPasswordInTheError()
    {
        var result = await new PostgresDeletionMarkSource().ReadAllAsync(ClosedPort, TestContext.Current.CancellationToken);

        Assert.True(result.IsFailure);
        Assert.Equal(ReapplyDeletionsRefusals.SourceUnreadable, result.Error);
        var text = result.Error.ToString();
        Assert.DoesNotContain("127.0.0.1", text, StringComparison.Ordinal);
        Assert.DoesNotContain("secret", text, StringComparison.Ordinal);
    }
}
