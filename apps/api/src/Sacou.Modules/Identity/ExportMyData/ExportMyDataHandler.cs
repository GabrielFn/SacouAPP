using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.ExportMyData;

/// <summary>The document and the UTC day it was made, for the file name.</summary>
internal sealed record PersonalDataExport(JsonObject Document, DateOnly Day);

/// <summary>
/// Builds the personal data document on the spot (Gabriel, 15/11: nothing is stored on the server): the fixed header,
/// then each module's section in <see cref="IAccountExportSection.Order"/>, written with the API's JSON rules
/// (ADR 0056, D9). Two sections with one name fail loudly instead of one hiding the other.
/// </summary>
internal sealed partial class ExportMyDataHandler(
    ICurrentUser currentUser,
    IEnumerable<IAccountExportSection> sections,
    IOptions<JsonOptions> json,
    TimeProvider time,
    ILogger<ExportMyDataHandler> logger)
{
    public const string FormatField = "format";
    public const string VersionField = "version";
    public const string GeneratedAtField = "generatedAt";

    public async Task<Result<PersonalDataExport>> HandleAsync(CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<PersonalDataExport>(user.Error);
        }

        var options = json.Value.SerializerOptions;
        var now = time.GetUtcNow();
        var document = new JsonObject
        {
            [FormatField] = AccountExportSections.Format,
            [VersionField] = AccountExportSections.FormatVersion,
            [GeneratedAtField] = JsonSerializer.SerializeToNode(now, options),
        };
        foreach (var section in sections.OrderBy(section => section.Order).ThenBy(section => section.Name, StringComparer.Ordinal))
        {
            var value = await section.ExportAsync(user.Value.UserId, cancellationToken).ConfigureAwait(false);
            document.Add(section.Name, value is null ? null : JsonSerializer.SerializeToNode(value, value.GetType(), options));
        }

        Generated(logger);
        return Result.Success(new PersonalDataExport(document, DateOnly.FromDateTime(now.UtcDateTime)));
    }

    /// <summary>No user, member or group id, and no count that could single someone out (ADR 0056, D11).</summary>
    [LoggerMessage(Level = LogLevel.Information, Message = "Account export generated.")]
    private static partial void Generated(ILogger logger);
}
