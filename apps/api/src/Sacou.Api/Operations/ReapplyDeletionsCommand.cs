using System.Globalization;
using Sacou.Api.Configuration;
using Sacou.Modules.Identity;
using Sacou.Modules.Identity.ReapplyDeletions;

namespace Sacou.Api.Operations;

/// <summary>
/// <c>reapply-deletions --dump-created-at &lt;ISO 8601&gt;</c> (E6.3, ADR 0082, D10): after a backup is restored and
/// before the API serves it, everyone who deleted the account goes again. <c>SACOU_DATABASE_URL</c> is the restored
/// database; <see cref="SourceVariable"/> is the current one, through the backup's read-only role. The output is one
/// line of numbers and codes: never a login, a hash, an id, a name or a URL.
/// </summary>
public sealed class ReapplyDeletionsCommand(IReadOnlyList<string> arguments) : IOperationCommand
{
    public const string Name = "reapply-deletions";

    /// <summary>The current database, whose marks are the ones that count (door 2).</summary>
    public const string SourceVariable = "SACOU_DELETIONS_SOURCE_DATABASE_URL";

    public const int Succeeded = 0;
    public const int UsageError = 2;
    public const int DumpTooOld = 4;

    private const string DumpCreatedAtOption = "--dump-created-at";
    private const string Prefix = Name + ": ";

    /// <summary>The manifest's <c>createdAt</c> (<c>date -u +%Y-%m-%dT%H:%M:%SZ</c>), or any instant with its offset.</summary>
    private static readonly string[] InstantFormats =
        ["yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", "yyyy-MM-dd'T'HH:mm:sszzz", "yyyy-MM-dd'T'HH:mm:ss.FFFFFFFzzz"];

    public async Task<int> RunAsync(IServiceProvider services, TextWriter output, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(output);
        if (ParseDumpCreatedAt(arguments) is not { } dumpCreatedAt)
        {
            return await UsageAsync(output, "missing or invalid " + DumpCreatedAtOption).ConfigureAwait(false);
        }

        var configuration = services.GetRequiredService<IConfiguration>();
        if (string.IsNullOrWhiteSpace(configuration[DatabaseConnectionSetup.ConnectionStringKey]))
        {
            return await UsageAsync(output, "missing " + DatabaseUrl.EnvironmentVariable).ConfigureAwait(false);
        }

        var source = DatabaseUrl.ToConnectionString(configuration[SourceVariable], services.GetRequiredService<IHostEnvironment>().IsDevelopment());
        if (source.IsFailure)
        {
            return await UsageAsync(output, $"{SourceVariable} ({source.Error.Code})").ConfigureAwait(false);
        }

        if (!DeletionMarkRetention.Covers(dumpCreatedAt, services.GetRequiredService<TimeProvider>().GetUtcNow()))
        {
            return await TooOldAsync(output).ConfigureAwait(false);
        }

        await DatabaseMigrations.ApplyAsync(services, cancellationToken).ConfigureAwait(false);
        var reapplied = await IdentityModule.ReapplyDeletionsAsync(services, source.Value, dumpCreatedAt, cancellationToken).ConfigureAwait(false);
        if (reapplied.IsFailure)
        {
            return await TooOldAsync(output).ConfigureAwait(false);
        }

        await output.WriteLineAsync(Prefix + Describe(reapplied.Value)).ConfigureAwait(false);
        return Succeeded;
    }

    /// <summary>Exactly <c>--dump-created-at &lt;instant&gt;</c>, the instant with its offset (a bare local time is refused).</summary>
    internal static DateTimeOffset? ParseDumpCreatedAt(IReadOnlyList<string> arguments) =>
        arguments is [DumpCreatedAtOption, var value]
            && DateTimeOffset.TryParseExact(value, InstantFormats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var instant)
            ? instant.ToUniversalTime()
            : null;

    internal static string Describe(ReapplyDeletionsSummary summary)
    {
        ArgumentNullException.ThrowIfNull(summary);
        return string.Create(
            CultureInfo.InvariantCulture,
            $"ok, {summary.Marks} marks, {summary.NewMarks} new marks, {summary.AccountsErased} accounts erased, {summary.GroupsWithoutAdmin} groups left without admin, {summary.Elapsed.TotalSeconds:0.0} s");
    }

    private static async Task<int> UsageAsync(TextWriter output, string problem)
    {
        await output.WriteLineAsync(
            $"{Prefix}usage: {Name} {DumpCreatedAtOption} <ISO 8601 with offset>, with {DatabaseUrl.EnvironmentVariable} " +
            $"(the restored database) and {SourceVariable} (the current one, read only): {problem}").ConfigureAwait(false);
        return UsageError;
    }

    private static async Task<int> TooOldAsync(TextWriter output)
    {
        await output.WriteLineAsync(
            string.Create(CultureInfo.InvariantCulture, $"{Prefix}dump older than the mark retention ({DeletionMarkRetention.Days} days)")).ConfigureAwait(false);
        return DumpTooOld;
    }
}
