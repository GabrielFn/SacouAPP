using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Infrastructure.CloudTasks;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>E10 and E11 of E3.11: one task per minute window, and an outage of Cloud Tasks never fails the caller.</summary>
public sealed class NotificationSchedulerTests : IDisposable
{
    private const int WritesInOneMinute = 10;

    private static readonly DateTimeOffset Now = new(2026, 11, 20, 12, 0, 10, TimeSpan.Zero);

    private static readonly NotificationTasksOptions Settings = new()
    {
        Project = "sacou-test",
        Location = "us-east4",
        Queue = "sacou-notifications-test",
        ServiceUrl = "https://sacou-api-test-abc.a.run.app",
        InvokerEmail = "sacou-tasks-invoker@sacou-test.iam.gserviceaccount.com",
    };

    private readonly FixedTimeProvider clock = new(Now);
    private readonly StubHttpHandler metadata = new(_ => StubHttpHandler.Json("""{"access_token":"ya29.SECRET","expires_in":3599,"token_type":"Bearer"}"""));

    [Theory]
    [InlineData("2026-11-20T12:05:00Z", "pump-202611201205")]
    [InlineData("2026-11-20T12:05:00.001Z", "pump-202611201206")]
    [InlineData("2026-11-20T12:05:59Z", "pump-202611201206")]
    [InlineData("2026-11-20T11:00:00Z", "pump-202611201202")]
    public void Window_RoundsUp_AndNeverBeforeTheNextMinute(string due, string task) =>
        Assert.Equal(task, PumpWindow.Of(DateTimeOffset.Parse(due, System.Globalization.CultureInfo.InvariantCulture), Now).TaskId);

    [Fact]
    public async Task E10_TenWritesInOneMinute_MakeOneTask()
    {
        var bodies = new List<string>();
        using var tasks = new StubHttpHandler(request =>
        {
            bodies.Add(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
            return StubHttpHandler.Json("{}", status: bodies.Count == 1 ? HttpStatusCode.OK : HttpStatusCode.Conflict);
        });
        var scheduler = Scheduler(tasks);

        for (var write = 0; write < WritesInOneMinute; write++)
        {
            await scheduler.ScheduleAsync(Now.AddSeconds(30 + write), TestContext.Current.CancellationToken);
        }

        Assert.Equal(1, tasks.RequestCount);
        Assert.Equal(new Uri("https://cloudtasks.googleapis.com/v2/projects/sacou-test/locations/us-east4/queues/sacou-notifications-test/tasks"), tasks.RequestedUris[0]);
        using var body = JsonDocument.Parse(bodies[0]);
        var task = body.RootElement.GetProperty("task");
        Assert.EndsWith("/tasks/pump-202611201201", task.GetProperty("name").GetString(), StringComparison.Ordinal);
        Assert.Equal("2026-11-20T12:01:00Z", task.GetProperty("scheduleTime").GetString());
        var call = task.GetProperty("httpRequest");
        Assert.Equal("https://sacou-api-test-abc.a.run.app/internal/notifications/pump", call.GetProperty("url").GetString());
        Assert.Equal(Settings.InvokerEmail, call.GetProperty("oidcToken").GetProperty("serviceAccountEmail").GetString());
        Assert.Equal(Settings.ServiceUrl, call.GetProperty("oidcToken").GetProperty("audience").GetString());
    }

    [Fact]
    public async Task AnEarlierWindow_IsAskedAgain_ALaterOneIsNot()
    {
        using var tasks = new StubHttpHandler(_ => StubHttpHandler.Json("{}"));
        var scheduler = Scheduler(tasks);

        await scheduler.ScheduleAsync(Now.AddMinutes(15), TestContext.Current.CancellationToken);
        await scheduler.ScheduleAsync(Now.AddMinutes(20), TestContext.Current.CancellationToken);
        await scheduler.ScheduleAsync(Now.AddMinutes(1), TestContext.Current.CancellationToken);

        Assert.Equal(2, tasks.RequestCount);
    }

    [Fact]
    public async Task AConflict_CountsAsQueued()
    {
        using var tasks = new StubHttpHandler(_ => StubHttpHandler.Json("{}", status: HttpStatusCode.Conflict));
        var scheduler = Scheduler(tasks);

        await scheduler.ScheduleAsync(Now.AddMinutes(5), TestContext.Current.CancellationToken);
        await scheduler.ScheduleAsync(Now.AddMinutes(5), TestContext.Current.CancellationToken);

        Assert.Equal(1, tasks.RequestCount);
    }

    [Fact]
    public async Task E11_CloudTasksDown_NeverThrows_AndIsAskedAgainNextTime()
    {
        using var tasks = new StubHttpHandler(_ => throw new HttpRequestException(HttpRequestError.ConnectionError, "down"));
        var scheduler = Scheduler(tasks);

        await scheduler.ScheduleAsync(Now.AddMinutes(5), TestContext.Current.CancellationToken);
        await scheduler.ScheduleAsync(Now.AddMinutes(5), TestContext.Current.CancellationToken);

        Assert.Equal(2, tasks.RequestCount);
    }

    [Fact]
    public void IncompleteSettings_AreNotConfigured()
    {
        Assert.True(Settings.IsConfigured);
        Assert.False(new NotificationTasksOptions().IsConfigured);
        Assert.False(new NotificationTasksOptions { Project = "p", Location = "l", Queue = "q", ServiceUrl = "http://plain", InvokerEmail = "a@b" }.IsConfigured);
    }

    public void Dispose() => metadata.Dispose();

    private CloudTasksNotificationScheduler Scheduler(StubHttpHandler tasks) => new(
        new HttpClient(tasks, disposeHandler: false),
        new MetadataAccessToken(new SingleClientFactory(metadata), clock),
        Options.Create(Settings),
        new ScheduledWindows(),
        clock,
        NullLogger<CloudTasksNotificationScheduler>.Instance);

    private sealed class SingleClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }
}
