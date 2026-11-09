using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Sacou.Api.Tests;

/// <summary>
/// The real Program with a test project id, no migration and a database nobody listens on, so a
/// test that reaches the database fails fast instead of touching a real one.
/// </summary>
public sealed class SacouApiFactory : WebApplicationFactory<Program>
{
    public const string TestProjectId = "sacou-test-project";

    /// <summary>Port 1 on loopback: closed, so a connection is refused at once. No password.</summary>
    public const string ClosedDatabase = "Host=127.0.0.1;Port=1;Database=sacou;Username=sacou;Timeout=2";

    public string ProjectId { get; init; } = TestProjectId;

    public string Environment { get; init; } = "Development";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment(Environment);
        builder.UseSetting("Firebase:ProjectId", ProjectId);
        builder.UseSetting("ConnectionStrings:Sacou", ClosedDatabase);
        builder.UseSetting("Database:MigrateOnStartup", "false");
    }
}
