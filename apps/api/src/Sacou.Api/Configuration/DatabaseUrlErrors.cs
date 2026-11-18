using Sacou.Shared.Results;

namespace Sacou.Api.Configuration;

/// <summary>Why <see cref="DatabaseUrl"/> refused a URL. Codes only: the URL and its password never reach a message.</summary>
public static class DatabaseUrlErrors
{
    public static readonly Error Empty = Invalid("database_url.empty");
    public static readonly Error Malformed = Invalid("database_url.malformed");
    public static readonly Error Scheme = Invalid("database_url.scheme");
    public static readonly Error Host = Invalid("database_url.host");
    public static readonly Error Database = Invalid("database_url.database");
    public static readonly Error Username = Invalid("database_url.username");
    public static readonly Error UnknownParameter = Invalid("database_url.unknown_parameter");
    public static readonly Error SslMode = Invalid("database_url.ssl_mode");
    public static readonly Error InsecureSslMode = Invalid("database_url.insecure_ssl_mode");
    public static readonly Error ChannelBinding = Invalid("database_url.channel_binding");

    /// <summary>No connection string and no URL while the start must migrate.</summary>
    public static readonly Error Missing = Invalid("database_url.missing");

    private static Error Invalid(string code) => new(code, ErrorKind.Validation);
}
