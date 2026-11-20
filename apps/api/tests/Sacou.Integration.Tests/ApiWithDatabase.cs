using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Matches;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Notifications;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Sessions;
using Sacou.Modules.Stats;
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

    /// <summary>
    /// Limits far above what any test sends, so only the rate limiting tests meet one (ADR 0062). The concurrency of the
    /// two-connection routes stays the real one (shared and per user); both queues are long, so a race test waits instead of getting a 429.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, string?> RoomyRateLimits = BuildRoomyRateLimits();

    private readonly IntegrationDatabase database;

    private readonly IReadOnlyDictionary<string, string?> settings;

    private Func<Task>? afterCurrentUserResolved;

    private Func<Task>? beforeCourtStreamChanged;

    public ApiWithDatabase(IntegrationDatabase database)
        : this(database, new Dictionary<string, string?>())
    {
    }

    /// <summary>The same API with more settings on top, applied last (the rate limiting tests set low limits and a small pool).</summary>
    public ApiWithDatabase(IntegrationDatabase database, IReadOnlyDictionary<string, string?> settings)
    {
        this.database = database;
        this.settings = settings;
        Key = TestSigningKey.Create(KeyId);
        Keys = new StubHttpHandler(_ => StubHttpHandler.Json(TestSigningKeys.Document(Key), TimeSpan.FromHours(1)));
    }

    internal TestSigningKey Key { get; }

    internal StubHttpHandler Keys { get; }

    internal string ConnectionString => database.ConnectionString;

    /// <summary>The round page's origin the share links start with (ADR 0070, D1).</summary>
    internal const string PublicBaseUrl = "https://sacou.test";

    /// <summary>Every log message and scope of the API, at the levels appsettings.json lets through, for the tests that prove what never reaches a log.</summary>
    internal CollectingLoggerProvider Logs { get; } = new();

    /// <summary>The push service the API talks to; null keeps the one the API registers (in part 1 of E3.11, the disabled one).</summary>
    internal IPushGateway? PushGateway { get; init; }

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

    /// <summary>
    /// Runs before the Stats hears of a write that finished or undid a match (E3.9, ADR 0071), so a test can make the
    /// listener fail after the commit.
    /// </summary>
    internal Func<Task>? BeforeCourtStreamChanged
    {
        get => Volatile.Read(ref beforeCourtStreamChanged);
        set => Volatile.Write(ref beforeCourtStreamChanged, value);
    }

    /// <summary>Applies the Identity, Groups, Sessions, Matches and then Stats migrations, through the entry points Program uses, in its order.</summary>
    public async Task MigrateAsync()
    {
        await MigrationGate.WaitAsync(TestContext.Current.CancellationToken);
        try
        {
            await IdentityModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
            await GroupsModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
            await SessionsModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
            await MatchesModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
            await StatsModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
            await NotificationsModule.MigrateAsync(Services, TestContext.Current.CancellationToken);
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
        builder.UseSetting("RoundPage:PublicBaseUrl", PublicBaseUrl);
        foreach (var (key, value) in RoomyRateLimits.Concat(settings))
        {
            builder.UseSetting(key, value);
        }

        builder.ConfigureLogging(logging => logging.AddProvider(Logs));
        builder.ConfigureServices(HookMembership);
        builder.ConfigureServices(HookCurrentUser);
        builder.ConfigureServices(HookCourtStreamChanged);
        builder.ConfigureServices(services =>
        {
            _ = services.RemoveAll<TimeProvider>();
            _ = services.AddSingleton<TimeProvider>(Clock);
            if (PushGateway is { } gateway)
            {
                _ = services.RemoveAll<IPushGateway>();
                _ = services.AddSingleton(gateway);
            }
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

    /// <summary>Wraps the Stats' listener of the court writes in a pass-through that runs <see cref="BeforeCourtStreamChanged"/>.</summary>
    private void HookCourtStreamChanged(IServiceCollection services)
    {
        var original = services.Single(descriptor => descriptor.ServiceType == typeof(ICourtStreamChanged));
        var implementation = original.ImplementationType ?? throw new InvalidOperationException("ICourtStreamChanged is registered by type.");
        _ = services.Remove(original);
        _ = services.AddScoped<ICourtStreamChanged>(provider => new HookedCourtStreamChanged(
            (ICourtStreamChanged)ActivatorUtilities.CreateInstance(provider, implementation), () => BeforeCourtStreamChanged));
    }

    private static Dictionary<string, string?> BuildRoomyRateLimits()
    {
        const string Section = "RateLimiting";
        const string Roomy = "1000000";
        string[] windows = ["Global", "SignIn", "Invite", "GroupCreate", "InviteCreate", "Draw", "MemberLevels", "AccountExport", "AccountDelete", "CourtSync", "RoundLink", "PushDevice"];
        var limits = windows.ToDictionary(window => $"{Section}:{window}:PermitLimit", _ => (string?)Roomy, StringComparer.Ordinal);
        limits[$"{Section}:DualConnectionQueue"] = Roomy;
        limits[$"{Section}:DualConnectionPerUserQueue"] = Roomy;
        return limits;
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
