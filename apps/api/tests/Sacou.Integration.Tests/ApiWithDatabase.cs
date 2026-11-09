using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups;
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

    internal string ConnectionString => database.ConnectionString;

    /// <summary>Every log message and scope of the API, at the levels appsettings.json lets through, for the tests that prove what never reaches a log.</summary>
    internal CollectingLoggerProvider Logs { get; } = new();

    /// <summary>Applies the Identity and then the Groups migrations, through the entry points Program uses, in its order.</summary>
    public async Task MigrateAsync()
    {
        await IdentityModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
        await GroupsModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Production");
        builder.UseSetting("Firebase:ProjectId", TestIdToken.ProjectId);
        builder.UseSetting("ConnectionStrings:Sacou", database.ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.ConfigureLogging(logging => logging.AddProvider(Logs));
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
