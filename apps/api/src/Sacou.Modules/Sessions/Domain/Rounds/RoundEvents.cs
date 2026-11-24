using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>What happened. Only ids and numbers: no name, no e-mail, no user (ADR 0012). The promotions go to the Outbox (ADR 0069).</summary>
internal abstract record RoundEvent(RoundId RoundId);

internal sealed record RoundCreated(RoundId RoundId, GroupId GroupId) : RoundEvent(RoundId);

internal sealed record RoundCanceled(RoundId RoundId, GroupId GroupId) : RoundEvent(RoundId);

/// <summary>Someone tapped "Encerrar rodada" (named apart from the error <c>sessions.round-closed</c>): the MVP vote opens (E3.11 pushes it; only ids).</summary>
internal sealed record RoundEnded(RoundId RoundId, GroupId GroupId) : RoundEvent(RoundId);

/// <summary>The admin confirmed the teams (ADR 0078). Only the ids of the round and the group: the push "os times saíram" hangs here later.</summary>
internal sealed record RoundTeamsConfirmed(RoundId RoundId, GroupId GroupId) : RoundEvent(RoundId);

internal sealed record AttendanceChanged(RoundId RoundId, MemberId MemberId, AttendanceStatus Status) : RoundEvent(RoundId);

/// <summary>
/// The first in line took a spot. <see cref="Sequence"/> is the promoted attendance's: it changes only when the person
/// leaves and comes back (ADR 0043, D3), so it tells a second, legitimate promotion from a repeated request (ADR 0069, D2).
/// </summary>
internal sealed record WaitlistPromoted(RoundId RoundId, MemberId MemberId, int Sequence, DateTimeOffset PromotedAt) : RoundEvent(RoundId);
