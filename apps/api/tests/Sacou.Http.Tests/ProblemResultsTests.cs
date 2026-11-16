using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Http.Tests;

/// <summary>H1 to H3: each error kind becomes its own status, a fixed title and the code, and nothing else.</summary>
public sealed class ProblemResultsTests
{
    private const string Code = "sample.code";

    private static readonly Dictionary<string, object?> GroupIds = new() { ["groupIds"] = new[] { "a" } };

    /// <summary>Written by hand, never derived from the production switch.</summary>
    public static readonly TheoryData<ErrorKind, int, string, string> ExpectedShapes = new()
    {
        { ErrorKind.Validation, 400, "Validation failed", "https://tools.ietf.org/html/rfc9110#section-15.5.1" },
        { ErrorKind.Forbidden, 403, "Forbidden", "https://tools.ietf.org/html/rfc9110#section-15.5.4" },
        { ErrorKind.NotFound, 404, "Not found", "https://tools.ietf.org/html/rfc9110#section-15.5.5" },
        { ErrorKind.Conflict, 409, "Conflict", "https://tools.ietf.org/html/rfc9110#section-15.5.10" },
        { ErrorKind.Gone, 410, "Gone", "https://tools.ietf.org/html/rfc9110#section-15.5.11" },
    };

    [Theory]
    [MemberData(nameof(ExpectedShapes))]
    public async Task EachKind_HasItsStatusTitleTypeAndCode(ErrorKind kind, int status, string title, string type)
    {
        var (written, body) = await WriteAsync(new Error(Code, kind));

        Assert.Equal(status, written);
        Assert.Equal(status, body["status"]!.GetValue<int>());
        Assert.Equal(title, body["title"]!.GetValue<string>());
        Assert.Equal(type, body["type"]!.GetValue<string>());
        Assert.Equal(Code, body[ProblemResults.CodeExtension]!.GetValue<string>());
    }

    /// <summary>H2: a new kind fails here until it gets a status of its own and a row above.</summary>
    [Fact]
    public void EveryKind_HasARowAndAStatus()
    {
        var kinds = Enum.GetValues<ErrorKind>();

        Assert.Equal(kinds.Length, ExpectedShapes.Count);
        Assert.All(kinds, kind => Assert.InRange(ProblemResults.From(new Error(Code, kind)).StatusCode, 400, 499));
    }

    [Fact]
    public void UnknownKind_IsAProgrammingError()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => ProblemResults.From(new Error(Code, (ErrorKind)99)));
    }

    /// <summary>H3: only these fields, so no detail, received value or id can ride along.</summary>
    [Fact]
    public async Task Body_HoldsOnlyTheFixedFieldsAndTheTraceId()
    {
        var (_, body) = await WriteAsync(new Error(Code, ErrorKind.Validation));

        Assert.Equal(
            ["code", "status", "title", "traceId", "type"],
            body.Select(field => field.Key).Order(StringComparer.Ordinal));
    }

    /// <summary>The extensions of a refusal ride along with the code, which they can never replace.</summary>
    [Fact]
    public async Task Extensions_GoNextToTheCode()
    {
        var (status, body) = await WriteAsync(
            ProblemResults.From(new Error(Code, ErrorKind.Conflict), GroupIds));

        Assert.Equal(409, status);
        Assert.Equal(Code, body[ProblemResults.CodeExtension]!.GetValue<string>());
        Assert.Equal("[\"a\"]", body["groupIds"]!.ToJsonString());
        Assert.Throws<ArgumentException>(() => ProblemResults.From(
            new Error(Code, ErrorKind.Conflict), new Dictionary<string, object?> { [ProblemResults.CodeExtension] = "other" }));
    }

    [Fact]
    public void Success_UsesTheSuccessResult()
    {
        var result = Result.Success(7).ToHttpResult(value => Microsoft.AspNetCore.Http.TypedResults.Ok(value));

        var ok = Assert.IsType<Microsoft.AspNetCore.Http.HttpResults.Ok<int>>(result.Result);
        Assert.Equal(7, ok.Value);
    }

    [Fact]
    public void Failure_UsesTheProblem()
    {
        var result = Result.Failure<int>(new Error(Code, ErrorKind.Conflict))
            .ToHttpResult(value => Microsoft.AspNetCore.Http.TypedResults.Ok(value));

        var problem = Assert.IsType<Microsoft.AspNetCore.Http.HttpResults.ProblemHttpResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);
    }

    private static Task<(int Status, JsonObject Body)> WriteAsync(Error error) => WriteAsync(ProblemResults.From(error));

    private static async Task<(int Status, JsonObject Body)> WriteAsync(Microsoft.AspNetCore.Http.HttpResults.ProblemHttpResult problem)
    {
        await using var services = new ServiceCollection().AddLogging().AddProblemDetails().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        using var stream = new MemoryStream();
        context.Response.Body = stream;

        await problem.ExecuteAsync(context);

        var body = JsonNode.Parse(stream.ToArray())!.AsObject();
        return (context.Response.StatusCode, body);
    }
}
