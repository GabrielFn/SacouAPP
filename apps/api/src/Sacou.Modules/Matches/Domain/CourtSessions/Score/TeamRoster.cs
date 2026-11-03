using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score;

/// <summary>The members of a team, by <c>MemberId</c> only: a lowercase UUID, never a name (ADR 0022).</summary>
internal sealed record TeamRoster(ImmutableArray<string> MemberIds);
