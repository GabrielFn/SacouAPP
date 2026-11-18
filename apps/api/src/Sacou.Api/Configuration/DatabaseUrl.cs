using Npgsql;
using Sacou.Shared.Results;

namespace Sacou.Api.Configuration;

/// <summary>
/// Turns the <c>postgresql://</c> URL the Neon panel gives into an Npgsql connection string (ADR 0068, D5 and D6).
/// Pure: no configuration, no environment. The error is a code only, so it never carries the URL or the password.
/// </summary>
public static class DatabaseUrl
{
    /// <summary>The environment variable Cloud Run fills from Secret Manager.</summary>
    public const string EnvironmentVariable = "SACOU_DATABASE_URL";

    /// <summary>
    /// Direct connection to a 0.25 CU Neon compute (105 free connections): up to three processes during a
    /// deploy, 3 × 30 = 90. Also covers the two-connection routes, 2 × 8 + 4 = 20 (ADR 0062).
    /// </summary>
    public const int MaximumPoolSize = 30;

    /// <summary>Idle connections close quickly, so they do not keep Neon awake (ADR 0068, R3).</summary>
    public const int ConnectionIdleLifetimeSeconds = 60;

    public const int ConnectionPruningIntervalSeconds = 10;

    public const int DefaultPort = 5432;

    private const int UnsetPort = -1;
    private const char UserInfoSeparator = ':';
    private const char QuerySeparator = '&';
    private const char KeyValueSeparator = '=';
    private const string SslModeKey = "sslmode";
    private const string ChannelBindingKey = "channel_binding";

    private static readonly HashSet<string> Schemes = new(["postgresql", "postgres"], StringComparer.OrdinalIgnoreCase);

    /// <summary>Modes that never check the server certificate: only on a developer machine.</summary>
    private static readonly Dictionary<string, SslMode> InsecureSslModes = new(StringComparer.Ordinal)
    {
        ["disable"] = SslMode.Disable,
        ["allow"] = SslMode.Allow,
        ["prefer"] = SslMode.Prefer,
    };

    private static readonly HashSet<string> SecureSslModes = new(["require", "verify-ca", "verify-full"], StringComparer.Ordinal);

    private static readonly Dictionary<string, ChannelBinding> ChannelBindings = new(StringComparer.Ordinal)
    {
        ["disable"] = ChannelBinding.Disable,
        ["prefer"] = ChannelBinding.Prefer,
        ["require"] = ChannelBinding.Require,
    };

    /// <summary>
    /// The connection string, always with <c>SSL Mode=VerifyFull</c> unless <paramref name="isDevelopment"/> allows
    /// an insecure <c>sslmode</c>. Any query parameter other than <c>sslmode</c> and <c>channel_binding</c> is refused,
    /// so a URL cannot turn on <c>Include Error Detail</c> or send <c>options</c> to the server.
    /// </summary>
    public static Result<string> ToConnectionString(string? url, bool isDevelopment)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return Failure(DatabaseUrlErrors.Empty);
        }

        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri))
        {
            return Failure(DatabaseUrlErrors.Malformed);
        }

        return ReadUri(uri, isDevelopment);
    }

    private static Result<string> ReadUri(Uri uri, bool isDevelopment)
    {
        if (!Schemes.Contains(uri.Scheme))
        {
            return Failure(DatabaseUrlErrors.Scheme);
        }

        var database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
        var credentials = uri.UserInfo.Split(UserInfoSeparator, 2);
        var error = uri.Host.Length == 0 ? DatabaseUrlErrors.Host
            : database.Length == 0 || database.Contains('/', StringComparison.Ordinal) ? DatabaseUrlErrors.Database
            : credentials[0].Length == 0 ? DatabaseUrlErrors.Username
            : null;
        if (error is not null)
        {
            return Failure(error);
        }

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port == UnsetPort ? DefaultPort : uri.Port,
            Database = database,
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : null,
            SslMode = SslMode.VerifyFull,
            MaxPoolSize = MaximumPoolSize,
            ConnectionIdleLifetime = ConnectionIdleLifetimeSeconds,
            ConnectionPruningInterval = ConnectionPruningIntervalSeconds,
        };
        var queryError = ApplyQuery(builder, uri.Query, isDevelopment);
        return queryError is null ? Result.Success(builder.ConnectionString) : Failure(queryError);
    }

    private static Error? ApplyQuery(NpgsqlConnectionStringBuilder builder, string query, bool isDevelopment)
    {
        foreach (var pair in query.TrimStart('?').Split(QuerySeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split(KeyValueSeparator, 2);
            var key = Uri.UnescapeDataString(parts[0]);
            var value = parts.Length > 1 ? Uri.UnescapeDataString(parts[1]) : string.Empty;
            var error = key switch
            {
                SslModeKey => ApplySslMode(builder, value, isDevelopment),
                ChannelBindingKey => ApplyChannelBinding(builder, value),
                _ => DatabaseUrlErrors.UnknownParameter,
            };
            if (error is not null)
            {
                return error;
            }
        }

        return null;
    }

    private static Error? ApplySslMode(NpgsqlConnectionStringBuilder builder, string value, bool isDevelopment)
    {
        if (InsecureSslModes.TryGetValue(value, out var insecure))
        {
            if (!isDevelopment)
            {
                return DatabaseUrlErrors.InsecureSslMode;
            }

            builder.SslMode = insecure;
            return null;
        }

        return SecureSslModes.Contains(value) ? null : DatabaseUrlErrors.SslMode;
    }

    private static Error? ApplyChannelBinding(NpgsqlConnectionStringBuilder builder, string value)
    {
        if (!ChannelBindings.TryGetValue(value, out var binding))
        {
            return DatabaseUrlErrors.ChannelBinding;
        }

        builder.ChannelBinding = binding;
        return null;
    }

    private static Result<string> Failure(Error error) => Result.Failure<string>(error);
}
