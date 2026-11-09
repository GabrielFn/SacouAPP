using System.Text.Json;
using Xunit;

namespace Sacou.Http.Tests;

/// <summary>
/// The request body rules (ADR 0039): unknown fields, repeated keys and numeric enums never bind; reading
/// ignores case, writing is camelCase.
/// </summary>
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

    /// <summary>Reading ignores case, by decision (ADR 0039): <c>"SECONDVALUE"</c> and <c>"Name"</c> bind.</summary>
    [Theory]
    [InlineData("""{"name":"a","kind":"SECONDVALUE"}""")]
    [InlineData("""{"Name":"a","kind":"secondvalue"}""")]
    [InlineData("""{"NAME":"a","KIND":"SecondValue"}""")]
    public void AnyCase_Binds(string json)
    {
        Assert.Equal(new Sample("a", SampleKind.SecondValue), JsonSerializer.Deserialize<Sample>(json, Options));
    }

    /// <summary>A comma combines values only in a [Flags] enum; here it is a 400.</summary>
    [Theory]
    [InlineData("""{"name":"a","kind":"firstValue,secondValue"}""")]
    [InlineData("""{"name":"a","kind":"firstValue, secondValue"}""")]
    public void CommaInANonFlagsEnum_IsRefused(string json)
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Sample>(json, Options));
    }

    [Fact]
    public void CommaInAFlagsEnum_CombinesValues()
    {
        Assert.Equal(SampleDays.Monday | SampleDays.Friday, JsonSerializer.Deserialize<SampleDays>("\"monday, friday\"", Options));
    }

    [Theory]
    [InlineData("""{"name":"a","kind":null}""", null)]
    [InlineData("""{"name":"a","kind":"secondValue"}""", SampleKind.SecondValue)]
    public void NullableEnum_BindsOneValue(string json, SampleKind? expected)
    {
        Assert.Equal(expected, JsonSerializer.Deserialize<OptionalSample>(json, Options)!.Kind);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<OptionalSample>("""{"name":"a","kind":"firstValue,secondValue"}""", Options));
    }

    /// <summary>One copy of each key, whatever its case: two copies would let two readers see two values.</summary>
    [Theory]
    [InlineData("""{"name":"a","name":"b"}""")]
    [InlineData("""{"name":"a","NAME":"b"}""")]
    public void RepeatedKey_IsRefused(string json)
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

    public enum SampleKind
    {
        FirstValue,
        SecondValue,
    }

    [Flags]
    internal enum SampleDays
    {
        None = 0,
        Monday = 1,
        Friday = 2,
    }

    internal sealed record OptionalSample(string Name, SampleKind? Kind);

    internal sealed record Sample(string Name, SampleKind Kind = SampleKind.FirstValue);
}
