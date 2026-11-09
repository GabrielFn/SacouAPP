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

    public static ProblemHttpResult From(Error error)
    {
        ArgumentNullException.ThrowIfNull(error);
        var shape = ShapeOf(error.Kind);
        return TypedResults.Problem(
            statusCode: shape.Status,
            title: shape.Title,
            type: SectionBase + shape.Section,
            extensions: new Dictionary<string, object?> { [CodeExtension] = error.Code });
    }

    private static ProblemShape ShapeOf(ErrorKind kind) => kind switch
    {
        ErrorKind.Validation => new(StatusCodes.Status400BadRequest, "Validation failed", "15.5.1"),
        ErrorKind.Forbidden => new(StatusCodes.Status403Forbidden, "Forbidden", "15.5.4"),
        ErrorKind.NotFound => new(StatusCodes.Status404NotFound, "Not found", "15.5.5"),
        ErrorKind.Conflict => new(StatusCodes.Status409Conflict, "Conflict", "15.5.10"),
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Every error kind needs a status."),
    };

    private sealed record ProblemShape(int Status, string Title, string Section);
}
