using System.Text.Json;
using Sacou.Http;
using Sacou.Modules.Groups.AddGuest;
using Sacou.Modules.Groups.CorrectGuest;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Guests;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Guests;

/// <summary>
/// How the guest bodies are read with the API's JSON rules (ADR 0039, ADR 0053): what the reader refuses before any
/// handler runs, and the profile the rules read from the text.
/// </summary>
public sealed class GuestRequestTests
{
    private const string RequestId = "0195f3c4-0000-7000-8000-000000000001";

    private static readonly JsonSerializerOptions Options = CreateOptions();

    [Fact]
    public void Creation_OnlyTheRequestIdAndTheNameAreNeeded()
    {
        var request = Read<AddGuestRequest>($$"""{"requestId":"{{RequestId}}","name":"Léo"}""");

        Assert.Equal((Guid.Parse(RequestId), "Léo", (string?)null, (decimal?)null), (request.RequestId, request.Name, request.PrimaryPosition, request.Level));
    }

    [Theory]
    [InlineData("""{"name":"Léo"}""")]
    [InlineData($$"""{"requestId":"{{RequestId}}"}""")]
    [InlineData("""{"requestId":"abc","name":"Léo"}""")]
    [InlineData($$"""{"requestId":"{{RequestId}}","name":"Léo","role":"admin"}""")]
    [InlineData($$"""{"requestId":"{{RequestId}}","name":"Léo","name":"Outro"}""")]
    [InlineData($$"""{"requestId":"{{RequestId}}","name":"Léo","level":"4.0"}""")]
    [InlineData($$"""{"requestId":"{{RequestId}}","name":"Léo","memberType":"regular"}""")]
    public void Creation_MissingOrUnknownFields_AreRefusedByTheReader(string json)
    {
        Assert.ThrowsAny<JsonException>(() => Read<AddGuestRequest>(json));
    }

    [Theory]
    [InlineData("""{"name":"Léo"}""")]
    [InlineData("""{"primaryPosition":null}""")]
    [InlineData("""{}""")]
    [InlineData("""{"name":"Léo","primaryPosition":null,"memberId":"0195f3c4-0000-7000-8000-000000000001"}""")]
    public void Correction_NeedsBothFields_AndNothingElse(string json)
    {
        Assert.ThrowsAny<JsonException>(() => Read<CorrectGuestRequest>(json));
    }

    [Fact]
    public void Correction_ANullPosition_IsRead()
    {
        var request = Read<CorrectGuestRequest>("""{"name":"Léo","primaryPosition":null}""");

        Assert.Equal(new GuestProfile(GuestName.Create("Léo").Value, null), GuestProfile.Read(request.Name, request.PrimaryPosition).Value);
    }

    [Fact]
    public void Profile_TheNameIsJudgedBeforeThePosition()
    {
        Assert.Equal(GroupErrors.GuestNameInvalid, GuestProfile.Read(null, "any").Error);
        Assert.Equal(GroupErrors.GuestInvalid, GuestProfile.Read("Léo", "any").Error);
        Assert.Equal(GuestPosition.Libero, GuestProfile.Read("Léo", "Libero").Value.Position);
    }

    private static T Read<T>(string json) => JsonSerializer.Deserialize<T>(json, Options)!;

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        ApiJson.Apply(options);
        return options;
    }
}
