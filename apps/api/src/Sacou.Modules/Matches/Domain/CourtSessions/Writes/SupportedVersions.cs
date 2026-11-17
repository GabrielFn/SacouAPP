using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// The versions this server replays, as lists so an old app offline still syncs once a version moves
/// on (ADR 0060, D10; threat model 3.1, item 7). Ports of <c>SUPPORTED_RULES_VERSIONS</c> of match-engine
/// and of <c>FORMATION_CATALOG_VERSION</c> of volley-rules: the C# catalog carries no version, and the
/// shared golden <c>server-checks.json</c> fails if these drift.
/// </summary>
internal static class SupportedVersions
{
    public const long CurrentRulesVersion = 1;

    public const long FormationCatalogVersion = 1;

    public static readonly ImmutableArray<long> RulesVersions = [CurrentRulesVersion];

    public static readonly ImmutableArray<long> FormationsVersions = [FormationCatalogVersion];

    public static readonly ImmutableArray<long> EventSchemaVersions = EventLogSchema.SupportedEventSchemaVersions;
}
