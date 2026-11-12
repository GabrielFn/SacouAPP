using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>
/// Lets <c>dotnet ef migrations add</c> build the context without the API. Never connects: generating
/// a migration only reads the model, so the connection string is a placeholder with no password.
/// </summary>
internal sealed class SessionsDesignTimeFactory : IDesignTimeDbContextFactory<SessionsDbContext>
{
    private const string DesignTimeConnection = "Host=localhost;Database=sacou";

    public SessionsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<SessionsDbContext>();
        SessionsDatabase.Configure(options, DesignTimeConnection);
        return new SessionsDbContext(options.Options);
    }
}
