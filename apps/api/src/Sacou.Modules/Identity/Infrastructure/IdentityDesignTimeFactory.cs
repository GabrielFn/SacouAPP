using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// Lets <c>dotnet ef migrations add</c> build the context without the API. Never connects: generating
/// a migration only reads the model, so the connection string is a placeholder with no password.
/// </summary>
internal sealed class IdentityDesignTimeFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    private const string DesignTimeConnection = "Host=localhost;Database=sacou";

    public IdentityDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<IdentityDbContext>();
        IdentityDatabase.Configure(options, DesignTimeConnection);
        return new IdentityDbContext(options.Options);
    }
}
