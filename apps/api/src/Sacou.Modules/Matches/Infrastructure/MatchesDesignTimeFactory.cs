using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// Lets <c>dotnet ef migrations add</c> build the context without the API. Never connects: generating
/// a migration only reads the model, so the connection string is a placeholder with no password.
/// </summary>
internal sealed class MatchesDesignTimeFactory : IDesignTimeDbContextFactory<MatchesDbContext>
{
    private const string DesignTimeConnection = "Host=localhost;Database=sacou";

    public MatchesDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<MatchesDbContext>();
        MatchesDatabase.Configure(options, DesignTimeConnection);
        return new MatchesDbContext(options.Options);
    }
}
