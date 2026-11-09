using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Identity;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Integration.Tests;

/// <summary>
/// The real API on the throwaway Postgres, with the Google keys served by a stub handler behind the
/// real named client: the whole sign-in path runs, except the network. Settings only through UseSetting.
/// </summary>
public sealed class ApiWithDatabase : WebApplicationFactory<Program>
{
    private const string KeyId = "integration-key";

    private readonly IntegrationDatabase database;

    public ApiWithDatabase(IntegrationDatabase database)
    {
        this.database = database;
        Key = TestSigningKey.Create(KeyId);
        Keys = new StubHttpHandler(_ => StubHttpHandler.Json(TestSigningKeys.Document(Key), TimeSpan.FromHours(1)));
    }

    internal TestSigningKey Key { get; }

    internal StubHttpHandler Keys { get; }

    /// <summary>Applies the Identity migrations through the same entry point Program uses.</summary>
    public Task MigrateAsync() => IdentityModule.MigrateAsync(Services, TestContext.Current.CancellationToken);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Production");
        builder.UseSetting("Firebase:ProjectId", TestIdToken.ProjectId);
        builder.UseSetting("ConnectionStrings:Sacou", database.ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.ConfigureServices(services => services
            .AddHttpClient(IdentityModule.SigningKeysHttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => Keys)
            .SetHandlerLifetime(Timeout.InfiniteTimeSpan));
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            Key.Dispose();
        }

        base.Dispose(disposing);
    }
}
