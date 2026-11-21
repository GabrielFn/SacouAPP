using Microsoft.Extensions.Configuration;
using Sacou.Modules.Identity.Authentication;
using Sacou.Modules.Identity.Contracts;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Authentication;

/// <summary>The keys the Notifications module checks against its own settings are the ones the route really reads.</summary>
public sealed class ServiceCallerKeysTests
{
    [Fact]
    public void TheContractKeys_BindTheAcceptedCaller()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [ServiceCallers.AudienceKey] = "https://sacou-api.example.run.app",
            [ServiceCallers.EmailKey] = "caller@example.iam.gserviceaccount.com",
        }).Build();

        var caller = configuration.GetSection(ServiceCallerOptions.SectionName).Get<ServiceCallerOptions>();

        Assert.Equal(("https://sacou-api.example.run.app", "caller@example.iam.gserviceaccount.com"), (caller?.Audience, caller?.Email));
    }
}
