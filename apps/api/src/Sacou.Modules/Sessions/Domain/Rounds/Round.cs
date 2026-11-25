using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Shared.Members;
using Sacou.Shared.Persistence;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>
/// One occurrence of the racha, with its attendances inside (<c>produto.md:261</c>). Immutable: every change
/// returns a new value. <see cref="SettingsLayerJson"/> is the round's layer of the settings, opaque here: only
/// <c>IGroupSettingsReader.ResolveRound</c> reads it (ADR 0041). The rules are in <c>AttendanceRules</c>,
/// the lists and positions in <c>Round.Lists.cs</c>.
/// </summary>
internal sealed partial record Round(
    RoundId Id,
    GroupId GroupId,
    SeriesId? SeriesId,
    RoundSlot Slot,
    Venue Venue,
    string? SettingsLayerJson,
    RoundStatus Status,
    int NextSequence,
    ImmutableArray<Attendance> Attendances)
{
    public const int FirstSequence = 1;

    /// <summary>The code of the public link (ADR 0070, D1). Null only for a round made before the link existed, until an admin reads it.</summary>
    public RoundLinkCode? LinkCode { get; init; }

    /// <summary>When someone tapped "Encerrar rodada" (ADR 0072, D1); null while nobody did.</summary>
    public DateTimeOffset? ClosedAt { get; init; }

    /// <summary>The teams of the last "Confirmar e compartilhar" (ADR 0078); null until the first.</summary>
    public RoundTeams? Teams { get; init; }

    public bool IsCanceled => Status == RoundStatus.Canceled;

    /// <summary>When the round ended: the tap, or the automatic end, whichever comes first (ADR 0072, D1).</summary>
    public DateTimeOffset EndsAt => RoundEnd.Of(Slot.StartsAt, ClosedAt);

    /// <summary>
    /// Whether the round's link still lets someone in and answer: not cancelled, not ended early, and not started. At the very instant
    /// of the start it is already closed (ADR 0070, D2).
    /// </summary>
    public bool IsOpenForLinkAt(DateTimeOffset now) => !IsCanceled && ClosedAt is null && now < Slot.StartsAt;

    /// <summary>A round with no attendance yet. The mensalistas come in with <c>AttendanceRules.SeedRegulars</c>.</summary>
    public static RoundChange Create(
        RoundId id, GroupId group, SeriesId? series, RoundSlot slot, Venue venue, string? settingsLayerJson)
    {
        var round = new Round(id, group, series, slot, venue, settingsLayerJson, RoundStatus.Scheduled, FirstSequence, []);
        return new RoundChange(round, [], [new RoundCreated(id, group)]) { RoundRowChanged = true };
    }

    /// <summary>Cancelling twice is a success without effect.</summary>
    public RoundChange Cancel() => IsCanceled
        ? RoundChange.Unchanged(this)
        : new RoundChange(this with { Status = RoundStatus.Canceled }, [], [new RoundCanceled(Id, GroupId)]) { RoundRowChanged = true };

    /// <summary>
    /// "Encerrar rodada" (ADR 0072, D1): refused once cancelled; before the start it is refused too, unless a match
    /// was already finished (<paramref name="hasFinishedMatch"/>, ADR 0076), and then the end is the tap. Closing again
    /// keeps the first instant, whatever the court holds now, so a close again never needs the court (ADR 0081, Part 2).
    /// A tap after the automatic end is stored but does not move the end (the earlier one wins).
    /// </summary>
    public Result<RoundChange> Close(DateTimeOffset now, bool hasFinishedMatch)
    {
        if (IsCanceled)
        {
            return Result.Failure<RoundChange>(RoundErrors.RoundCanceled);
        }

        if (ClosedAt is not null)
        {
            return Result.Success(RoundChange.Unchanged(this));
        }

        if (now < Slot.StartsAt && !hasFinishedMatch)
        {
            return Result.Failure<RoundChange>(RoundErrors.RoundNotStarted);
        }

        return Result.Success(
            new RoundChange(this with { ClosedAt = StoredInstant.Of(now) }, [], [new RoundEnded(Id, GroupId)]) { RoundRowChanged = true });
    }

    /// <summary>
    /// The admin's edit (date, time, venue, layer): refused once cancelled, ended early or started. A new date or time
    /// recalculates the instant; the layer, when given, replaces the whole one.
    /// </summary>
    public Result<RoundChange> Edit(RequestedSlot? slot, Venue? venue, LayerEdit layer, DateTimeOffset now)
    {
        if (IsCanceled || ClosedAt is not null || Slot.StartsAt <= now)
        {
            return Result.Failure<RoundChange>(RoundErrors.RoundClosed);
        }

        var edited = this with
        {
            Slot = slot?.Slot ?? Slot,
            Venue = venue ?? Venue,
            SettingsLayerJson = layer.Replaces ? layer.Json : SettingsLayerJson,
        };
        return Result.Success(new RoundChange(edited, [], []) { RoundRowChanged = edited != this });
    }

    /// <summary>
    /// "Confirmar e compartilhar" on screen 07 (ADR 0078): the teams replace the earlier ones whole. Refused once cancelled
    /// or ended (the instant of the end included); accepted after the start, as the draw happens at the court. Who may play
    /// is decided here: the round's occupants still active in the group (<paramref name="active"/>).
    /// </summary>
    public Result<RoundChange> ConfirmTeams(
        ImmutableArray<ImmutableArray<MemberId>> teams,
        ImmutableArray<MemberId> reserves,
        IReadOnlySet<MemberId> active,
        int playersPerTeam,
        DateTimeOffset now)
    {
        if (IsCanceled || EndsAt <= now)
        {
            return Result.Failure<RoundChange>(RoundErrors.RoundClosed);
        }

        var confirmed = Occupants.Select(attendance => attendance.Member).ToHashSet();
        var created = RoundTeams.Create(teams, reserves, new TeamsEligibility(confirmed, active, playersPerTeam), StoredInstant.Of(now));
        return created.IsFailure
            ? Result.Failure<RoundChange>(created.Error)
            : Result.Success(new RoundChange(this with { Teams = created.Value }, [], [new RoundTeamsConfirmed(Id, GroupId)])
            {
                RoundRowChanged = true,
                TeamsChanged = true,
            });
    }

    /// <summary>The round with its link code: a new round before it is stored, or an older one that has none yet.</summary>
    public Round WithLinkCode(RoundLinkCode code) => this with { LinkCode = code };

    /// <summary>Inserts or replaces one attendance.</summary>
    internal Round With(Attendance attendance) => this with
    {
        Attendances = [.. Attendances.Where(existing => existing.Member != attendance.Member), attendance],
    };

    /// <summary>The next order number, under the round's lock.</summary>
    internal Round WithNextSequenceTaken() => this with { NextSequence = NextSequence + 1 };

    public Attendance? AttendanceOf(MemberId member) =>
        Attendances.FirstOrDefault(attendance => attendance.Member == member);
}

/// <summary>A layer in an edit: keep the current one, or replace it with this (null clears it).</summary>
internal readonly record struct LayerEdit(bool Replaces, string? Json)
{
    public static readonly LayerEdit Keep = new(false, null);

    public static LayerEdit Replace(string? json) => new(true, json);
}
