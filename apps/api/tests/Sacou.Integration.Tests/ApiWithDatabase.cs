using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions;
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

    /// <summary>One migrator at a time: every test class migrates the one shared database when it starts, and two runners applying a pending migration together fail on "already exists".</summary>
    private static readonly SemaphoreSlim MigrationGate = new(1, 1);

    private readonly IntegrationDatabase database;

    private Func<Task>? afterCurrentUserResolved;

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

    /// <summary>The API's clock: the real time, moved to wherever a test sets it (tokens are minted by it too, so they stay valid).</summary>
    internal ShiftableClock Clock { get; } = new();

    /// <summary>
    /// Runs before every <see cref="IGroupMembership.FindActiveAsync"/> of a request, with the 1-based number of
    /// that lookup in the request (1 is the access filter, 2 is the one under the round's lock). Lets a test
    /// change the Groups tables at an exact moment of a write.
    /// </summary>
    internal Func<int, Task>? BeforeMembershipLookup { get; set; }

    /// <summary>
    /// Runs once, right after the next <see cref="ICurrentUser.GetAsync"/> resolves the user, and is then cleared.
    /// Lets a test delete the account between a write's resolution of the person and its transaction.
    /// </summary>
    internal Func<Task>? AfterCurrentUserResolved
    {
        get => Volatile.Read(ref afterCurrentUserResolved);
        set => Volatile.Write(ref afterCurrentUserResolved, value);
    }

    /// <summary>Applies the Identity, Groups and then Sessions migrations, through the entry points Program uses, in its order.</summary>
    public async Task MigrateAsync()
    {
        await MigrationGate.WaitAsync(TestContext.Current.CancellationToken);
        try
        {
            await IdentityModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
            await GroupsModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
            await SessionsModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
        }
        finally
        {
            MigrationGate.Release();
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Production");
        builder.UseSetting("Firebase:ProjectId", TestIdToken.ProjectId);
        builder.UseSetting("ConnectionStrings:Sacou", database.ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.ConfigureLogging(logging => logging.AddProvider(Logs));
        builder.ConfigureServices(HookMembership);
        builder.ConfigureServices(HookCurrentUser);
        builder.ConfigureServices(services =>
        {
            _ = services.RemoveAll<TimeProvider>();
            _ = services.AddSingleton<TimeProvider>(Clock);
        });
        builder.ConfigureServices(services => services
            .AddHttpClient(IdentityModule.SigningKeysHttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => Keys)
            .SetHandlerLifetime(Timeout.InfiniteTimeSpan));
    }

    /// <summary>Wraps the Groups' own membership (whatever type it is) in a pass-through that runs <see cref="BeforeMembershipLookup"/>.</summary>
    private void HookMembership(IServiceCollection services)
    {
        var original = services.Single(descriptor => descriptor.ServiceType == typeof(IGroupMembership));
        var implementation = original.ImplementationType ?? throw new InvalidOperationException("IGroupMembership is registered by type.");
        _ = services.Remove(original);
        _ = services.AddScoped<IGroupMembership>(provider => new HookedMembership(
            (IGroupMembership)ActivatorUtilities.CreateInstance(provider, implementation), () => BeforeMembershipLookup));
    }

    /// <summary>Wraps the Identity's current user in a pass-through that runs <see cref="AfterCurrentUserResolved"/> once.</summary>
    private void HookCurrentUser(IServiceCollection services)
    {
        var original = services.Single(descriptor => descriptor.ServiceType == typeof(ICurrentUser));
        var implementation = original.ImplementationType ?? throw new InvalidOperationException("ICurrentUser is registered by type.");
        _ = services.Remove(original);
        _ = services.AddScoped<ICurrentUser>(provider => new HookedCurrentUser(
            (ICurrentUser)ActivatorUtilities.CreateInstance(provider, implementation),
            () => Interlocked.Exchange(ref afterCurrentUserResolved, null)));
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
