using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>What happened, for whoever listens later (the Outbox of E3.11). Only ids: no name, no e-mail, no user (ADR 0012).</summary>
internal abstract record RoundEvent(RoundId RoundId);

internal sealed record RoundCreated(RoundId RoundId, GroupId GroupId) : RoundEvent(RoundId);

internal sealed record RoundCanceled(RoundId RoundId, GroupId GroupId) : RoundEvent(RoundId);

internal sealed record AttendanceChanged(RoundId RoundId, MemberId MemberId, AttendanceStatus Status) : RoundEvent(RoundId);

internal sealed record WaitlistPromoted(RoundId RoundId, MemberId MemberId, DateTimeOffset PromotedAt) : RoundEvent(RoundId);
