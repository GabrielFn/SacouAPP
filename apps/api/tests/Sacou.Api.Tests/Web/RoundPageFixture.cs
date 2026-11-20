using System.Collections.Immutable;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Api.Web;
using Sacou.Modules.Sessions.Contracts;

namespace Sacou.Api.Tests.Web;

/// <summary>
/// The round page on the real composition, with the public summary and the built files replaced: one round per code,
/// so the HTML does not depend on a database or on a local build of <c>apps/web</c>.
/// </summary>
internal static class RoundPageFixture
{
    public const string Code = "K7fQ2xK7fQ2xK7fQ2xK7fQ";
    public const string OtherCode = "ZZZZZZZZZZZZZZZZZZZZZZ";
    public const string Script = "/web/assets/round-HASH.js";
    public const string Style = "/web/assets/round-HASH.css";
    public const string InviteScript = "/web/assets/invite-HASH.js";
    public const string AuthDomain = "sacou-test.firebaseapp.com";

    /// <summary>"9 de 12, 1 na espera" of screen 01: six mensalistas and three avulsos, names as markers.</summary>
    public static PublicRoundSummary NineOfTwelve(string groupName = "Vôlei de quinta", string venue = "Arena Beira-Mar") => new(
        groupName,
        LocalDate: "2026-11-05",
        LocalTime: "19:00",
        TimeZone: "America/Sao_Paulo",
        StartsAt: new DateTimeOffset(2026, 11, 5, 22, 0, 0, TimeSpan.Zero),
        venue,
        PublicRoundState.Open,
        Capacity: 12,
        GoingCount: 9,
        WaitlistCount: 1,
        WaitlistEnabled: true,
        PlayersPerTeam: 6,
        PointsPerSet: 25,
        LoserLeaves: true,
        Going: [.. Enumerable.Range(1, 9).Select(place => new PublicListEntry($"ZZNICK{place}", Regular: place <= 6))]);

    public static WebApplicationFactory<Program> Factory(
        SacouApiFactory factory, IReadOnlyDictionary<string, PublicRoundSummary> rounds, bool withFirebase = true) =>
        factory.WithWebHostBuilder(builder =>
        {
            if (withFirebase)
            {
                builder.UseSetting("Firebase:Web:ApiKey", "public-test-key");
                builder.UseSetting("Firebase:Web:AuthDomain", AuthDomain);
                builder.UseSetting("Firebase:Web:ProjectId", "sacou-test");
                builder.UseSetting("Firebase:Web:AppId", "1:2:web:3");
            }

            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IPublicRoundSummary>(new FakeSummaries(rounds));
                services.AddSingleton<IWebAssets>(new FakeAssets());
            });
        });

    public static IReadOnlyDictionary<string, PublicRoundSummary> One(PublicRoundSummary summary) =>
        new Dictionary<string, PublicRoundSummary>(StringComparer.Ordinal) { [Code] = summary };

    private sealed class FakeSummaries(IReadOnlyDictionary<string, PublicRoundSummary> rounds) : IPublicRoundSummary
    {
        public Task<PublicRoundSummary?> FindByCodeAsync(string? code, CancellationToken cancellationToken) =>
            Task.FromResult(code is not null && rounds.TryGetValue(code, out var summary) ? summary : null);
    }

    private sealed class FakeAssets : IWebAssets
    {
        public WebEntry? Round { get; } = new(Script, ImmutableArray.Create(Style));

        public WebEntry? Invite { get; } = new(InviteScript, ImmutableArray.Create(Style));
    }
}
