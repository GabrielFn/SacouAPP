using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Sacou.Shared.Results;

namespace Sacou.Http;

/// <summary>
/// A business error as a <c>ProblemDetails</c> body: status and fixed English title by kind, and the
/// stable code in the <c>code</c> extension. Never a detail, a received value or an id (ADR 0039).
/// The pt-BR text lives in the app, by code.
/// </summary>
public static class ProblemResults
{
    public const string CodeExtension = "code";

    private const string SectionBase = "https://tools.ietf.org/html/rfc9110#section-";

    public static ProblemHttpResult From(Error error) => From(error, new Dictionary<string, object?>());

    /// <summary>
    /// The same body with more extensions, for the few refusals whose app screen needs ids the caller already owns
    /// (the groups that block the account deletion, ADR 0056). Never a received value; <c>code</c> cannot be replaced.
    /// </summary>
    public static ProblemHttpResult From(Error error, IReadOnlyDictionary<string, object?> extensions)
    {
        ArgumentNullException.ThrowIfNull(error);
        ArgumentNullException.ThrowIfNull(extensions);
        if (extensions.ContainsKey(CodeExtension))
        {
            throw new ArgumentException("The code extension comes from the error.", nameof(extensions));
        }

        var shape = ShapeOf(error.Kind);
        var all = new Dictionary<string, object?>(extensions) { [CodeExtension] = error.Code };
        return TypedResults.Problem(statusCode: shape.Status, title: shape.Title, type: SectionBase + shape.Section, extensions: all);
    }

    private static ProblemShape ShapeOf(ErrorKind kind) => kind switch
    {
        ErrorKind.Validation => new(StatusCodes.Status400BadRequest, "Validation failed", "15.5.1"),
        ErrorKind.Forbidden => new(StatusCodes.Status403Forbidden, "Forbidden", "15.5.4"),
        ErrorKind.NotFound => new(StatusCodes.Status404NotFound, "Not found", "15.5.5"),
        ErrorKind.Conflict => new(StatusCodes.Status409Conflict, "Conflict", "15.5.10"),
        ErrorKind.Gone => new(StatusCodes.Status410Gone, "Gone", "15.5.11"),
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Every error kind needs a status."),
    };

    private sealed record ProblemShape(int Status, string Title, string Section);
}
