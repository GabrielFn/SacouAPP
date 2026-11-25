namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// Which database a connection reached, asked of the server itself (E6.3, S2): <c>localhost</c> and <c>127.0.0.1</c>, an
/// IP and its DNS name, or a Host with several servers may all reach the same one. The name and oid of the database, the
/// port the server is configured with (not inet_server_port(), which is NULL over a Unix socket) and the instant the server started, which two servers do not share. The server address is
/// left out, since one server answers on <c>127.0.0.1</c> and <c>::1</c> alike; <c>system_identifier</c> is left out,
/// since <c>pg_control_system()</c> is for superusers and the backup's role is not one. Never printed.
/// </summary>
internal static class DatabaseInstance
{
    public const string Query =
        "SELECT concat_ws('/', current_database(), (SELECT oid FROM pg_database WHERE datname = current_database()), " +
        "current_setting('port'), extract(epoch FROM pg_postmaster_start_time())) AS \"Value\"";
}
