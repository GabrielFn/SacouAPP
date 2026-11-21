using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Notifications.Infrastructure.CloudTasks;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>The audience and the account Cloud Tasks sends must be the ones the internal route accepts, or every call is a silent 401.</summary>
public sealed class NotificationTasksOptionsValidatorTests
{
    private const string ServiceUrl = "https://sacou-api-test.example.run.app";
    private const string Invoker = "sacou-tasks-invoker-test@sacou-test.iam.gserviceaccount.com";

    [Fact]
    public void TheSameAudienceAndAccount_PassTheStart()
    {
        var result = Validate(ServiceUrl, Invoker, ServiceUrl, Invoker);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "")]
    [InlineData(ServiceUrl, null)]
    [InlineData(null, Invoker)]
    public void EitherSideMissing_IsNotAMismatch(string? audience, string? email)
    {
        Assert.True(Validate(ServiceUrl, Invoker, audience, email).Succeeded);
        Assert.True(Validate(string.Empty, string.Empty, ServiceUrl, Invoker).Succeeded);
    }

    [Fact]
    public void ADifferentAudience_StopsTheStart_NamingTheKeys_NeverTheValues()
    {
        var result = Validate(ServiceUrl, Invoker, "https://sacou-api.example.run.app", Invoker);

        Assert.True(result.Failed);
        Assert.Contains("NotificationTasks:ServiceUrl", result.FailureMessage, StringComparison.Ordinal);
        Assert.Contains(ServiceCallers.AudienceKey, result.FailureMessage, StringComparison.Ordinal);
        Assert.DoesNotContain("example.run.app", result.FailureMessage, StringComparison.Ordinal);
    }

    [Fact]
    public void ADifferentAccount_StopsTheStart()
    {
        var result = Validate(ServiceUrl, Invoker, ServiceUrl, "sacou-tasks-invoker@sacou-prod.iam.gserviceaccount.com");

        Assert.True(result.Failed);
        Assert.Contains("NotificationTasks:InvokerEmail", result.FailureMessage, StringComparison.Ordinal);
        Assert.Contains(ServiceCallers.EmailKey, result.FailureMessage, StringComparison.Ordinal);
        Assert.DoesNotContain("iam.gserviceaccount.com", result.FailureMessage, StringComparison.Ordinal);
    }

    [Fact]
    public void TheModule_ChecksItOnStart()
    {
        var configuration = Configuration(ServiceUrl, Invoker, "https://other.example.run.app", Invoker);
        using var services = new ServiceCollection().AddLogging().AddNotificationsModule(configuration).BuildServiceProvider();

        var failure = Assert.Throws<OptionsValidationException>(() => services.GetRequiredService<IStartupValidator>().Validate());

        Assert.Contains(ServiceCallers.AudienceKey, failure.Message, StringComparison.Ordinal);
    }

    private static ValidateOptionsResult Validate(string serviceUrl, string invoker, string? audience, string? email) =>
        new NotificationTasksOptionsValidator(Configuration(serviceUrl, invoker, audience, email))
            .Validate(name: null, new NotificationTasksOptions { ServiceUrl = serviceUrl, InvokerEmail = invoker });

    private static IConfiguration Configuration(string serviceUrl, string invoker, string? audience, string? email) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["NotificationTasks:ServiceUrl"] = serviceUrl,
            ["NotificationTasks:InvokerEmail"] = invoker,
            [ServiceCallers.AudienceKey] = audience,
            [ServiceCallers.EmailKey] = email,
        }).Build();
}
