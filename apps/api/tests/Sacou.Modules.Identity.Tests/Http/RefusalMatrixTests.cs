using System.Net;
using Sacou.Modules.Identity.Authentication;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Http;

/// <summary>
/// Every refusal is the same 401: same ProblemDetails, <c>WWW-Authenticate: Bearer</c> with no error, the
/// store never reached, no new key fetch and nothing of the token in the logs. Each case first sends
/// the valid token it was built from, which must pass: the refusal comes from the rule, not the setup.
/// </summary>
public sealed class RefusalMatrixTests
{
    public static TheoryData<string> Cases => [.. RefusalCases.All.Keys];

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Refusal_IsTheSameUnauthorizedResponse(string caseName)
    {
        using var keys = RefusalKeys.Create();
        await using var host = await IdentityTestHost.StartAsync(keys.Known);
        var baseline = await UnauthorizedBodyAsync(host);
        var controlToken = keys.Valid.Sign();
        using (var control = await host.SignInAsync(controlToken))
        {
            Assert.Equal(HttpStatusCode.Created, control.StatusCode);
        }

        var attempt = RefusalCases.All[caseName](keys);
        var callsBefore = host.Users.Calls;
        using var response = await host.SignInAsync(attempt.Authorization, attempt.Path);

        ResponseAssert.IsBearerChallenge(response);
        Assert.Equal(baseline, await ResponseAssert.BodyWithoutTraceIdAsync(response));
        Assert.Equal(callsBefore, host.Users.Calls);
        Assert.All(host.Keys.RequestedUris, uri => Assert.Equal(GoogleSigningKeyFetcher.KeysUri, uri));
        Assert.Equal(1, host.Keys.RequestCount);
        LogAssert.HasNoSecrets(host.Logs, [controlToken, .. attempt.Authorization ?? [], attempt.Path]);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Refusal_LogsOnlyTheCategory(string caseName)
    {
        using var keys = RefusalKeys.Create();
        await using var host = await IdentityTestHost.StartAsync(keys.Known);
        var attempt = RefusalCases.All[caseName](keys);

        using var response = await host.SignInAsync(attempt.Authorization, attempt.Path);

        var refusals = host.Logs.Entries.Where(entry => entry.Contains("ID token refused", StringComparison.Ordinal)).ToList();
        Assert.True(refusals.Count <= 1, string.Join('\n', refusals));
        Assert.All(refusals, entry => Assert.Matches(@"ID token refused: [A-Za-z]+\. $", entry));
    }

    private static async Task<string> UnauthorizedBodyAsync(IdentityTestHost host)
    {
        using var response = await host.SignInAsync(authorization: null);
        ResponseAssert.IsBearerChallenge(response);
        return await ResponseAssert.BodyWithoutTraceIdAsync(response);
    }
}
