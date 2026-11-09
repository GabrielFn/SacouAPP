using System.Net;
using System.Text.RegularExpressions;
using Sacou.Modules.Identity.Authentication;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Http;

/// <summary>One host for the whole matrix: starting a host per case was most of the run time.</summary>
public sealed class RefusalHost : IAsyncLifetime
{
    internal IdentityTestHost Host { get; private set; } = null!;

    public async ValueTask InitializeAsync() => Host = await IdentityTestHost.StartAsync(RefusalKeys.SharedKnown);

    public async ValueTask DisposeAsync() => await Host.DisposeAsync();
}

/// <summary>
/// Every refusal is the same 401: same ProblemDetails, <c>WWW-Authenticate: Bearer</c> with no error, the
/// store never reached, no new key fetch, nothing of the token in the logs and exactly its category
/// logged. Each case first sends the valid token it was built from, which must pass: the refusal comes
/// from the rule, not the setup. The cases of one class run one after another, so log slices are theirs.
/// </summary>
public sealed partial class RefusalMatrixTests(RefusalHost fixture) : IClassFixture<RefusalHost>
{
    private const string RefusalMarker = "ID token refused";

    public static TheoryData<string> Cases => [.. RefusalCases.All.Keys];

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Refusal_IsTheSameUnauthorizedResponse(string caseName)
    {
        var host = fixture.Host;
        var keys = RefusalKeys.Create();
        var baseline = await UnauthorizedBodyAsync(host);
        var controlToken = keys.Valid.Sign();
        using (var control = await host.SignInAsync(controlToken))
        {
            Assert.True(control.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK, control.StatusCode.ToString());
        }

        var logStart = host.Logs.Count;
        var attempt = RefusalCases.All[caseName].Build(keys);
        var callsBefore = host.Users.Calls;
        using var response = await host.SignInAsync(attempt.Authorization, attempt.Path);

        ResponseAssert.IsBearerChallenge(response);
        Assert.Equal(baseline, await ResponseAssert.BodyWithoutTraceIdAsync(response));
        Assert.Equal(callsBefore, host.Users.Calls);
        Assert.All(host.Keys.RequestedUris, uri => Assert.Equal(GoogleSigningKeyFetcher.KeysUri, uri));
        Assert.Equal(1, host.Keys.RequestCount);
        LogAssert.HasNoSecrets(host.Logs.EntriesSince(logStart), [controlToken, .. attempt.Authorization ?? [], attempt.Path]);
    }

    /// <summary>L3: the refusal logs exactly its own category, once; none for a request with no token.</summary>
    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Refusal_LogsExactlyItsCategory(string caseName)
    {
        var host = fixture.Host;
        var refusal = RefusalCases.All[caseName];
        var attempt = refusal.Build(RefusalKeys.Create());
        var logStart = host.Logs.Count;

        using var response = await host.SignInAsync(attempt.Authorization, attempt.Path);

        var logged = host.Logs.EntriesSince(logStart)
            .Where(entry => entry.Contains(RefusalMarker, StringComparison.Ordinal))
            .Select(entry => RefusalLine().Match(entry).Value);
        string[] expected = refusal.Expected is { } category ? [$"{RefusalMarker}: {category}."] : [];
        Assert.Equal(expected, logged);
    }

    [GeneratedRegex(@"ID token refused: [A-Za-z]+\.")]
    private static partial Regex RefusalLine();

    private static async Task<string> UnauthorizedBodyAsync(IdentityTestHost host)
    {
        using var response = await host.SignInAsync(authorization: null);
        ResponseAssert.IsBearerChallenge(response);
        return await ResponseAssert.BodyWithoutTraceIdAsync(response);
    }
}
