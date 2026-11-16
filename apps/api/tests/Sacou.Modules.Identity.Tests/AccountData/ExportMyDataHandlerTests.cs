using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Sacou.Http;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.ExportMyData;
using Sacou.Shared.Results;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.AccountData;

/// <summary>The export document of E3.16 (ADR 0056, D9): fixed header, sections in order, the API's JSON rules.</summary>
public sealed class ExportMyDataHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 15, 23, 59, 30, TimeSpan.Zero);
    private static readonly Guid Person = Guid.CreateVersion7();

    [Fact]
    public async Task Document_HasTheHeaderThenTheSectionsInOrder()
    {
        var export = await ExportAsync(
            new Section("late", 900, new { Value = 1 }),
            new Section("early", 50, new { Value = 2 }),
            new Section("middle", 300, null));

        var keys = export.Value.Document.Select(pair => pair.Key).ToList();

        Assert.Equal(["format", "version", "generatedAt", "early", "middle", "late"], keys);
        Assert.Equal("sacou-personal-data", export.Value.Document["format"]!.GetValue<string>());
        Assert.Equal(1, export.Value.Document["version"]!.GetValue<int>());
        Assert.Equal(new DateOnly(2026, 11, 15), export.Value.Day);
        Assert.Null(export.Value.Document["middle"]);
    }

    [Fact]
    public async Task Sections_AreWrittenWithTheApiJsonRules()
    {
        var export = await ExportAsync(new Section("entry", 1, new Entry(DeletionBlockerKind.LastAdmin, Now)));

        var entry = export.Value.Document["entry"]!.AsObject();
        Assert.Equal(["kind", "respondedAt"], entry.Select(pair => pair.Key));
        Assert.Equal("lastAdmin", entry["kind"]!.GetValue<string>());
        Assert.Equal("2026-11-15T23:59:30+00:00", entry["respondedAt"]!.GetValue<string>());
    }

    [Fact]
    public async Task EachSection_GetsTheCallersUserId()
    {
        var section = new Section("one", 1, null);

        await ExportAsync(section);

        Assert.Equal([Person], section.Asked);
    }

    [Fact]
    public async Task TwoSectionsWithOneName_FailLoudly()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => ExportAsync(new Section("same", 1, null), new Section("same", 2, null)));
    }

    [Fact]
    public async Task Unregistered_IsRefused_AndNoSectionIsAsked()
    {
        var section = new Section("one", 1, null);
        var handler = Handler(Result.Failure<CurrentUser>(CurrentUserErrors.NotRegistered), section);

        var export = await handler.HandleAsync(TestContext.Current.CancellationToken);

        Assert.Equal(CurrentUserErrors.NotRegistered, export.Error);
        Assert.Empty(section.Asked);
    }

    [Fact]
    public void FileName_HasTheDayOnly()
    {
        Assert.Equal("sacou-meus-dados-2026-01-05.json", ExportMyDataEndpoint.FileName(new DateOnly(2026, 1, 5)));
    }

    /// <summary>The real sections are fixed in the contract: one name and one place each.</summary>
    [Fact]
    public void KnownSections_HaveDistinctNamesAndOrders()
    {
        string[] names = [AccountExportSections.Account, AccountExportSections.Profile, AccountExportSections.Groups, AccountExportSections.Attendances];
        int[] orders = [AccountExportSections.AccountOrder, AccountExportSections.ProfileOrder, AccountExportSections.GroupsOrder, AccountExportSections.AttendancesOrder];

        Assert.Equal(names.Length, names.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(orders.Order(), orders);
    }

    private static Task<Result<PersonalDataExport>> ExportAsync(params Section[] sections) =>
        Handler(Result.Success(new CurrentUser(Person)), sections).HandleAsync(TestContext.Current.CancellationToken);

    private static ExportMyDataHandler Handler(Result<CurrentUser> user, params Section[] sections)
    {
        var json = new JsonOptions();
        ApiJson.Apply(json.SerializerOptions);
        return new ExportMyDataHandler(
            new StubCurrentUser(user), sections, Options.Create(json), new FixedTimeProvider(Now), NullLogger<ExportMyDataHandler>.Instance);
    }

    private sealed record Entry(DeletionBlockerKind Kind, DateTimeOffset RespondedAt);

    private sealed class Section(string name, int order, object? value) : IAccountExportSection
    {
        public List<Guid> Asked { get; } = [];

        public string Name => name;

        public int Order => order;

        public Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
        {
            Asked.Add(userId);
            return Task.FromResult(value);
        }
    }

    private sealed class StubCurrentUser(Result<CurrentUser> user) : ICurrentUser
    {
        public Task<Result<CurrentUser>> GetAsync(CancellationToken cancellationToken) => Task.FromResult(user);
    }
}
