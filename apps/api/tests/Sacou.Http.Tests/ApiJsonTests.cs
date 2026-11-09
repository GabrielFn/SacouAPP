using System.Text.Json;
using Xunit;

namespace Sacou.Http.Tests;

/// <summary>The request body rules: unknown fields and numeric enums never bind (ADR 0039).</summary>
public sealed class ApiJsonTests
{
    private static readonly JsonSerializerOptions Options = Create();

    [Fact]
    public void KnownFields_Bind()
    {
        var body = JsonSerializer.Deserialize<Sample>("""{"name":"a","kind":"secondValue"}""", Options)!;

        Assert.Equal(new Sample("a", SampleKind.SecondValue), body);
    }

    [Theory]
    [InlineData("""{"name":"a","groupId":"x"}""")]
    [InlineData("""{"name":"a","kind":1}""")]
    [InlineData("""{"name":"a","kind":"thirdValue"}""")]
    public void UnknownFieldOrNumericEnum_IsRefused(string json)
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Sample>(json, Options));
    }

    [Fact]
    public void Enums_AreWrittenAsCamelCaseText()
    {
        Assert.Equal("""{"name":"a","kind":"secondValue"}""", JsonSerializer.Serialize(new Sample("a", SampleKind.SecondValue), Options));
    }

    private static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        ApiJson.Apply(options);
        return options;
    }

    internal enum SampleKind
    {
        FirstValue,
        SecondValue,
    }

    internal sealed record Sample(string Name, SampleKind Kind = SampleKind.FirstValue);
}
