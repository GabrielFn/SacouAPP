using System.Text.Json;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Series;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Modules.Sessions.RoundLinks;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.CreateRound;

/// <summary>
/// Date, time, venue and layer are checked before anything is stored. The round is born with the
/// mensalistas already confirmed (tela 20), by the same seeding the series uses; "repetir toda semana" starts the series
/// in the same transaction, under the group's creation lock, so the ceilings of D10 are exact. It is born with its link
/// code too (ADR 0070, D1), and the admin's response carries the link to share.
/// </summary>
internal sealed class CreateRoundHandler(RoundLinkCodes codes, GroupRoundContext groups, RoundShareLinks links, TimeProvider time)
{
    public async Task<Result<RoundResponse>> HandleAsync(RoundAccess access, CreateRoundRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        ArgumentNullException.ThrowIfNull(request);
        var now = time.GetUtcNow();
        var slot = ParseSlot(request, now);
        var venue = Venue.Create(request.Venue);
        if (slot.IsFailure || venue.IsFailure)
        {
            return Result.Failure<RoundResponse>(RoundErrors.RoundInvalid);
        }

        var state = await groups.LoadAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        if (state.IsFailure)
        {
            return Result.Failure<RoundResponse>(state.Error);
        }

        var layer = RoundRequestParsing.Layer(request.Settings ?? default);
        var resolved = layer.IsSuccess ? state.Value.ResolveRequested(layer.Value.Json) : Result.Failure<ResolvedRound>(layer.Error);
        return resolved.IsFailure
            ? Result.Failure<RoundResponse>(resolved.Error)
            : await StoreAsync(access, request, (slot.Value, venue.Value), resolved.Value, state.Value, now, cancellationToken).ConfigureAwait(false);
    }

    private static Result<RoundSlot> ParseSlot(CreateRoundRequest request, DateTimeOffset now)
    {
        var date = RoundRequestParsing.Date(request.LocalDate);
        var clock = RoundRequestParsing.Time(request.LocalTime);
        if (date.IsFailure || clock.IsFailure)
        {
            return Result.Failure<RoundSlot>(RoundErrors.RoundInvalid);
        }

        var requested = RoundSlot.Request(date.Value, clock.Value, now);
        return requested.IsSuccess ? Result.Success(requested.Value.Slot) : Result.Failure<RoundSlot>(requested.Error);
    }

    private async Task<Result<RoundResponse>> StoreAsync(
        RoundAccess access,
        CreateRoundRequest request,
        (RoundSlot Slot, Venue Venue) placement,
        ResolvedRound resolved,
        RoundGroupState state,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var series = request.RepeatWeekly
            ? RoundSeries.Start(SeriesId.New(now), access.GroupId, placement.Slot.Date, placement.Slot.Time, placement.Venue)
            : null;
        var created = Round.Create(RoundId.New(now), access.GroupId, series?.Id, placement.Slot, placement.Venue, resolved.Settings.LayerJson);
        var seeded = created.Then(round => RoundReconciliation.SeedRegulars(round, resolved.Rules, state.RegularsInJoinOrder(), now));
        var added = await codes.AddAsync(new NewRound(seeded, series, now, EnforceLimits: true), cancellationToken).ConfigureAwait(false);
        if (added.IsFailure)
        {
            return Result.Failure<RoundResponse>(added.Error);
        }

        var round = added.Value.Round;
        return Result.Success(links.Attach(RoundResponse.From(round, resolved, state, access.MemberId), round, access.Role));
    }
}

/// <summary>
/// <c>settings</c> is the round's own layer (tela 20); the group is never in the body, only in the route.
/// Unknown fields are a 400 (ADR 0039). <c>localDate</c> is "YYYY-MM-DD", <c>localTime</c> is "HH:mm".
/// </summary>
internal sealed record CreateRoundRequest(string? LocalDate, string? LocalTime, string? Venue, JsonElement? Settings, bool RepeatWeekly);
