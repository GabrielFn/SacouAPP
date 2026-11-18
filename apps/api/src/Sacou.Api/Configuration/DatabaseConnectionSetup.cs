using Sacou.Shared.Results;

namespace Sacou.Api.Configuration;

/// <summary>
/// Where the API finds its database (ADR 0068, D5). A filled <c>ConnectionStrings:Sacou</c> wins, so local development
/// does not change; otherwise <c>SACOU_DATABASE_URL</c> becomes that connection string.
/// </summary>
internal static class DatabaseConnectionSetup
{
    internal const string ConnectionStringKey = "ConnectionStrings:Sacou";
    internal const string MigrateOnStartupKey = "Database:MigrateOnStartup";

    internal static Result Apply(IConfiguration configuration, bool isDevelopment)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        if (!string.IsNullOrWhiteSpace(configuration[ConnectionStringKey]))
        {
            return Result.Success();
        }

        var url = configuration[DatabaseUrl.EnvironmentVariable];
        if (string.IsNullOrWhiteSpace(url))
        {
            // Nothing to migrate against: the start stops here instead of on an Npgsql error.
            return configuration.GetValue<bool>(MigrateOnStartupKey) ? Result.Failure(DatabaseUrlErrors.Missing) : Result.Success();
        }

        var connectionString = DatabaseUrl.ToConnectionString(url, isDevelopment);
        if (connectionString.IsFailure)
        {
            return Result.Failure(connectionString.Error);
        }

        configuration[ConnectionStringKey] = connectionString.Value;
        return Result.Success();
    }

    /// <summary>The start-up message: the variable and the error code, never the URL, the password or an inner exception.</summary>
    internal static string FailureMessage(Error error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return $"The database is not configured ({error.Code}). Set {DatabaseUrl.EnvironmentVariable} to the postgresql:// URL " +
            $"or {ConnectionStringKey} to a connection string.";
    }
}
