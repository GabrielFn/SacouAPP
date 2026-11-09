using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Api.Tests;

/// <summary>
/// A token sent in the query string is never read and never logged. The log levels come from the
/// real appsettings.json (Microsoft.AspNetCore at Warning hides the request line), not from a copy.
/// </summary>
public sealed class QueryStringTokenTests
{
    private const string SignInPath = "/v1/me";

    [Fact]
    public async Task TokenInTheQueryString_IsRefusedAndNeverLogged()
    {
        using var key = TestSigningKey.Create("query-key");
        var token = TestIdToken.Valid(key, FixedTimeProvider.WholeSecondNow()).Sign();
        using var logs = new CollectingLoggerProvider();
        await using var api = new SacouApiFactory();
        await using var factory = api.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.AddProvider(logs)));
        using var client = factory.CreateClient();

        using var inQuery = await client.PostAsync($"{SignInPath}?access_token={token}", content: null, TestContext.Current.CancellationToken);
        using var control = new HttpRequestMessage(HttpMethod.Post, SignInPath);
        control.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-token");
        using var refused = await client.SendAsync(control, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, inQuery.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refused.StatusCode);
        // Control: the provider does collect the API logs, so an empty search below means something.
        Assert.Contains(logs.Entries, entry => entry.Contains("ID token refused: Malformed.", StringComparison.Ordinal));
        var fragments = TestIdTokens.Fragments(token);
        Assert.DoesNotContain(logs.Entries, entry => fragments.Any(fragment => entry.Contains(fragment, StringComparison.Ordinal)));
        Assert.DoesNotContain(logs.Entries, entry => entry.Contains("access_token", StringComparison.Ordinal));
    }
}
