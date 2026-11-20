using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Modules.Stats.Projections;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Projections;

/// <summary>The keys of freshness (ADR 0071, 3.9): every fact outside the stream moves the hash, and nothing else does.</summary>
public sealed class ProjectionKeysTests
{
    private static readonly RoundFacts Facts = new(
        Guid.Parse("00000000-0000-4000-8000-000000000002"),
        RoundState.Scheduled,
        new DateTimeOffset(2026, 11, 20, 23, 30, 0, TimeSpan.Zero),
        new DateOnly(2026, 11, 20),
        new SummaryRules(GameModality.Indoor6x6, MvpEnabled: true, MvpByStats: true, IndividualPoints: false));

    public static TheoryData<string> ChangedFacts => ["state", "startsAt", "modality", "mvpEnabled", "mvpByStats", "individualPoints"];

    [Theory]
    [MemberData(nameof(ChangedFacts))]
    public void EveryFactOutsideTheStream_ChangesTheFactsHash(string fact)
    {
        var changed = fact switch
        {
            "state" => Facts with { State = RoundState.Canceled },
            "startsAt" => Facts with { StartsAt = Facts.StartsAt.AddMinutes(1) },
            "modality" => Facts with { Summary = Facts.Summary with { Modality = GameModality.Beach4x4 } },
            "mvpEnabled" => Facts with { Summary = Facts.Summary with { MvpEnabled = false } },
            "mvpByStats" => Facts with { Summary = Facts.Summary with { MvpByStats = false } },
            _ => Facts with { Summary = Facts.Summary with { IndividualPoints = true } },
        };

        Assert.NotEqual(ProjectionKeys.FactsHashOf(Facts), ProjectionKeys.FactsHashOf(changed));
    }

    [Fact]
    public void FactsHash_IsLowercaseHexOfSha256_AndTheSameForTheSameFacts()
    {
        var hash = ProjectionKeys.FactsHashOf(Facts);

        Assert.Equal(64, hash.Length);
        Assert.Matches("^[0-9a-f]{64}$", hash);
        Assert.Equal(hash, ProjectionKeys.FactsHashOf(Facts with { }));
    }

    [Fact]
    public void InputsHash_IgnoresTheOrderOfTheSeeds_ButNotTheirLevelSourceNorTheParamsVersion()
    {
        var ana = new RatingSeed(new MemberId(Guid.Parse("00000000-0000-4000-8000-0000000000a1")), 30, SeedSource.Default);
        var bia = new RatingSeed(new MemberId(Guid.Parse("00000000-0000-4000-8000-0000000000b1")), 45, SeedSource.Admin);
        RoundProjection[] rounds = [new(Facts, new CourtStreamHead(Facts.RoundId, Guid.NewGuid(), 7), 7, ProjectionKeys.FactsHashOf(Facts), SessionSummary.Empty)];

        var hash = ProjectionKeys.InputsHashOf(1, RatingPoolKind.Indoor, rounds, [ana, bia]);

        Assert.Equal(hash, ProjectionKeys.InputsHashOf(1, RatingPoolKind.Indoor, rounds, [bia, ana]));
        Assert.NotEqual(hash, ProjectionKeys.InputsHashOf(1, RatingPoolKind.Indoor, rounds, [ana, bia with { Source = SeedSource.Suggested }]));
        Assert.NotEqual(hash, ProjectionKeys.InputsHashOf(1, RatingPoolKind.Indoor, rounds, [ana, bia with { LevelTenths = 50 }]));
        Assert.NotEqual(hash, ProjectionKeys.InputsHashOf(2, RatingPoolKind.Indoor, rounds, [ana, bia]));
        Assert.NotEqual(hash, ProjectionKeys.InputsHashOf(1, RatingPoolKind.Beach, rounds, [ana, bia]));
        Assert.NotEqual(hash, ProjectionKeys.InputsHashOf(1, RatingPoolKind.Indoor, [rounds[0] with { EventCount = 8 }], [ana, bia]));
    }

    [Fact]
    public void StoredSummary_RoundTrips_ToTheSameText()
    {
        var memberId = Guid.Parse("00000000-0000-4000-8000-0000000000a1");
        var summary = SessionSummary.Empty with
        {
            MvpFormulaVersion = 1,
            Mvp = new MvpSummary(MvpKind.Team, [memberId], Side: null, 3, 2, 5, 2),
            Ranking = [new TeamStandingSummary([memberId], 2, 1, 0, 2, 30, 25)],
        };

        var text = SummaryJson.Write(summary);

        Assert.Contains("\"kind\":\"team\"", text, StringComparison.Ordinal);
        Assert.Equal(text, SummaryJson.Write(SummaryJson.Read(text)!));
        Assert.Null(SummaryJson.Read("{\"mvp\":{\"kind\":1}}"));
    }

    /// <summary>E3.9 part 3, condition 2: the pool comes from the typed modality, each modality has one, and the sand shares one.</summary>
    [Fact]
    public void EveryModality_HasAPool_AndTheSandSharesOne()
    {
        Assert.Equal(RatingPoolKind.Indoor, RatingPoolMapping.Of(GameModality.Indoor6x6));
        Assert.Equal(RatingPoolKind.Beach, RatingPoolMapping.Of(GameModality.Beach2x2));
        Assert.Equal(RatingPoolKind.Beach, RatingPoolMapping.Of(GameModality.Beach4x4));
        Assert.Equal(Enum.GetValues<GameModality>().Length, Enum.GetValues<GameModality>().Count(modality => RatingPoolKind.All.Contains(RatingPoolMapping.Of(modality))));
        Assert.All(RatingPoolKind.All, pool => Assert.Same(pool, RatingPoolKind.FromCode(pool.Code)));
    }

    [Fact]
    public void EveryLevelSource_HasTheSeedSourceOfTheSameCode()
    {
        Assert.Equal(
            Enum.GetValues<LevelSource>().Select(source => source.ToString().ToLowerInvariant()),
            Enum.GetValues<LevelSource>().Select(source => RatingPoolMapping.SourceOf(source).Code));
    }
}
