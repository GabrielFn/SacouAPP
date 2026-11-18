using System.Globalization;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Sacou.Http.RateLimiting;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Http.Tests.RateLimiting;

/// <summary>Case 4 of the plan: the shape of the 429, and nothing of the user in the body or the log (ADR 0062, D5).</summary>
public sealed class RateLimitRejectionTests
{
    private const string Subject = "firebase-uid-of-someone";
    private const int WaitSeconds = 30;

    [Fact]
    public async Task Refusal_IsAProblemWithCodeRetryAfterAndNoStore()
    {
        var (context, body, logs) = await RejectAsync();

        Assert.Equal(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
        Assert.StartsWith("application/problem+json", context.Response.ContentType, StringComparison.Ordinal);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
        Assert.Equal(WaitSeconds, int.Parse(context.Response.Headers.RetryAfter.ToString(), CultureInfo.InvariantCulture));
        Assert.Equal(PipelineErrorCodes.RateLimited, body[ProblemResults.CodeExtension]!.GetValue<string>());
        Assert.Equal(RateLimitRejection.Title, body["title"]!.GetValue<string>());
        Assert.Equal(429, body["status"]!.GetValue<int>());
        Assert.Equal(["code", "status", "title", "traceId", "type"], body.Select(field => field.Key).Order(StringComparer.Ordinal));
        Assert.Single(logs.Entries, entry => entry.Contains("rate limit", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Refusal_NeverCarriesTheSubjectTheKeyOrThePolicy()
    {
        var key = RateLimitPartitionKey.Of(RateLimitPartitionKeyTests.SignedIn(Subject))!;

        var (_, body, logs) = await RejectAsync();

        var text = body.ToJsonString();
        Assert.DoesNotContain(Subject, text, StringComparison.Ordinal);
        Assert.DoesNotContain(key, text, StringComparison.Ordinal);
        Assert.DoesNotContain(RateLimitPolicies.Draw, text, StringComparison.Ordinal);
        Assert.All(logs.Entries, entry =>
        {
            Assert.DoesNotContain(Subject, entry, StringComparison.Ordinal);
            Assert.DoesNotContain(key, entry, StringComparison.Ordinal);
        });
        Assert.Contains(logs.Entries, entry => entry.Contains("rate limit of " + RateLimitPolicies.Draw, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(0.2, 1)]
    [InlineData(1.0, 1)]
    [InlineData(1.1, 2)]
    [InlineData(59.5, 60)]
    public void RetryAfter_RoundsUp_AtLeastOne(double seconds, int expected)
    {
        using var lease = new WaitLease(TimeSpan.FromSeconds(seconds));

        Assert.Equal(expected, RateLimitRejection.RetryAfterSeconds(lease));
    }

    /// <summary>The full queue of the two-connection routes says nothing about when: one second.</summary>
    [Fact]
    public void RetryAfter_WithoutMetadata_IsOneSecond()
    {
        using var lease = new WaitLease(null);

        Assert.Equal(RateLimitRejection.FallbackRetryAfterSeconds, RateLimitRejection.RetryAfterSeconds(lease));
    }

    private static async Task<(HttpContext Context, JsonObject Body, CollectingLoggerProvider Logs)> RejectAsync()
    {
        var logs = new CollectingLoggerProvider();
        await using var services = new ServiceCollection()
            .AddLogging(logging => logging.AddProvider(logs))
            .AddProblemDetails()
            .BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services, User = RateLimitPartitionKeyTests.SignedIn(Subject) };
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(new EnableRateLimitingAttribute(RateLimitPolicies.Draw)), "draw"));
        using var stream = new MemoryStream();
        context.Response.Body = stream;
        using var lease = new WaitLease(TimeSpan.FromSeconds(WaitSeconds));

        await RateLimitRejection.WriteAsync(new OnRejectedContext { HttpContext = context, Lease = lease }, CancellationToken.None);

        return (context, JsonNode.Parse(stream.ToArray())!.AsObject(), logs);
    }

    private sealed class WaitLease(TimeSpan? wait) : RateLimitLease
    {
        public override bool IsAcquired => false;

        public override IEnumerable<string> MetadataNames => wait is null ? [] : [MetadataName.RetryAfter.Name];

        public override bool TryGetMetadata(string metadataName, out object? metadata)
        {
            metadata = wait;
            return wait is not null && metadataName == MetadataName.RetryAfter.Name;
        }
    }
}
