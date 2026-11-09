using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// Lets <c>dotnet ef migrations add</c> build the context without the API. Never connects: generating
/// a migration only reads the model, so the connection string is a placeholder with no password.
/// </summary>
internal sealed class GroupsDesignTimeFactory : IDesignTimeDbContextFactory<GroupsDbContext>
{
    private const string DesignTimeConnection = "Host=localhost;Database=sacou";

    public GroupsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<GroupsDbContext>();
        GroupsDatabase.Configure(options, DesignTimeConnection);
        return new GroupsDbContext(options.Options);
    }
}
