using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Npgsql;
using Sacou.Http.RateLimiting;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// Creating a group and accepting an invite hold two connections at once (ADR 0056, D7a). The pool must fit every
/// such request the rate limiter lets run together, plus a headroom for the other routes; otherwise the start fails
/// (ADR 0062, D4). The message never echoes the connection string.
/// </summary>
internal sealed class DualConnectionPoolValidator(IConfiguration configuration) : IValidateOptions<RateLimitingOptions>
{
    public ValidateOptionsResult Validate(string? name, RateLimitingOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var poolSize = MaxPoolSize(configuration.GetConnectionString(GroupsDatabase.ConnectionStringName));
        if (poolSize is null)
        {
            return ValidateOptionsResult.Fail("The connection string cannot be read to check the pool size.");
        }

        return options.DualConnectionPoolNeed <= poolSize
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(
                $"The pool has {poolSize} connections, but the two-connection routes and the headroom need {options.DualConnectionPoolNeed} " +
                $"({RateLimitingOptions.SectionName}:DualConnectionConcurrency and DualConnectionHeadroom against Maximum Pool Size).");
    }

    /// <summary>Npgsql's own reading of the string (100 when it does not say); null when the string does not parse.</summary>
    internal static int? MaxPoolSize(string? connectionString)
    {
        try
        {
            return new NpgsqlConnectionStringBuilder(connectionString ?? string.Empty).MaxPoolSize;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }
}
