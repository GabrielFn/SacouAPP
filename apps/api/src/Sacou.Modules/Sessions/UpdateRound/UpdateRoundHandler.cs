using System.Text.Json;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RoundLinks;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.UpdateRound;

/// <summary>
/// The admin's edit (tela 20 and 21). What can be refused without the lock is refused first: a bad date, time,
/// venue or layer locks nothing. Under the lock the round is edited, then reconciled with the new rules (more
/// spots promote the waitlist; fewer spots take nobody out, question 26).
/// </summary>
internal sealed class UpdateRoundHandler(GroupRoundContext groups, RoundWriter writer, RoundShareLinks links)
{
    /// <summary>A field of the request that may be absent (keep the current value).</summary>
    private readonly record struct Option<T>(bool Present, T? Value);

    private readonly record struct Edit(Option<DateOnly> Date, Option<TimeOnly> Time, Option<Venue> Venue, LayerEdit Layer);

    private readonly record struct SlotEdit(RequestedSlot? Slot);

    public async Task<Result<RoundResponse>> HandleAsync(RoundAccess access, RoundId id, UpdateRoundRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        ArgumentNullException.ThrowIfNull(request);
        var edit = await ParseAsync(access, request, cancellationToken).ConfigureAwait(false);
        if (edit.IsFailure)
        {
            return Result.Failure<RoundResponse>(edit.Error);
        }

        var written = await writer.ExecuteAsync(access, id, GroupCapability.ManageRounds, context => Apply(context, edit.Value), cancellationToken)
            .ConfigureAwait(false);
        return links.Respond(written, access);
    }

    private async Task<Result<Edit>> ParseAsync(RoundAccess access, UpdateRoundRequest request, CancellationToken cancellationToken)
    {
        var fields = ParseFields(request);
        if (fields.IsFailure)
        {
            return fields;
        }

        var layer = await ParseLayerAsync(access, request.Settings, cancellationToken).ConfigureAwait(false);
        return layer.IsFailure ? Result.Failure<Edit>(layer.Error) : Result.Success(fields.Value with { Layer = layer.Value });
    }

    /// <summary>Date, time and venue, each only if present; a present one that does not parse is <c>round-invalid</c>.</summary>
    private static Result<Edit> ParseFields(UpdateRoundRequest request)
    {
        var date = ParseIfPresent(request.LocalDate, RoundRequestParsing.Date);
        var time = ParseIfPresent(request.LocalTime, RoundRequestParsing.Time);
        var venue = ParseIfPresent(request.Venue, Venue.Create);
        return date.IsSuccess && time.IsSuccess && venue.IsSuccess
            ? Result.Success(new Edit(date.Value, time.Value, venue.Value, LayerEdit.Keep))
            : Result.Failure<Edit>(RoundErrors.RoundInvalid);
    }

    private static Result<Option<T>> ParseIfPresent<T>(string? text, Func<string?, Result<T>> parse)
        where T : notnull
    {
        if (text is null)
        {
            return Result.Success(new Option<T>(false, default));
        }

        var parsed = parse(text);
        return parsed.IsSuccess ? Result.Success(new Option<T>(true, parsed.Value)) : Result.Failure<Option<T>>(parsed.Error);
    }

    /// <summary>Absent keeps the layer; an object replaces it (an empty one clears it), validated and normalized against the group.</summary>
    private async Task<Result<LayerEdit>> ParseLayerAsync(RoundAccess access, JsonElement? settings, CancellationToken cancellationToken)
    {
        if (settings is not { } body)
        {
            return Result.Success(LayerEdit.Keep);
        }

        var layer = RoundRequestParsing.Layer(body);
        var state = await groups.LoadAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        if (layer.IsFailure || state.IsFailure)
        {
            return Result.Failure<LayerEdit>(layer.IsFailure ? layer.Error : state.Error);
        }

        var resolved = state.Value.ResolveRequested(layer.Value.Json);
        return resolved.IsFailure ? Result.Failure<LayerEdit>(resolved.Error) : Result.Success(LayerEdit.Replace(resolved.Value.Settings.LayerJson));
    }

    private static Result<RoundChange> Apply(RoundWriteContext context, Edit edit)
    {
        var slot = RequestedSlot(context, edit);
        if (slot.IsFailure)
        {
            return Result.Failure<RoundChange>(slot.Error);
        }

        var edited = context.Round.Edit(slot.Value.Slot, edit.Venue.Present ? edit.Venue.Value : null, edit.Layer, context.Now);
        if (edited.IsFailure)
        {
            return edited;
        }

        var rules = context.Group.ResolveStored(edited.Value.Round).Rules;
        return Result.Success(edited.Value.Then(round => RoundReconciliation.Reconcile(round, rules, context.Group.ActiveIds, context.Now)));
    }

    /// <summary>A new date or time asks for a new slot through the rule of <see cref="RoundSlot.Request"/>; neither keeps the current one.</summary>
    private static Result<SlotEdit> RequestedSlot(RoundWriteContext context, Edit edit)
    {
        if (!edit.Date.Present && !edit.Time.Present)
        {
            return Result.Success(new SlotEdit(null));
        }

        var date = edit.Date.Present ? edit.Date.Value : context.Round.Slot.Date;
        var time = edit.Time.Present ? edit.Time.Value : context.Round.Slot.Time;
        var slot = RoundSlot.Request(date, time, context.Now);
        return slot.IsFailure ? Result.Failure<SlotEdit>(slot.Error) : Result.Success(new SlotEdit(slot.Value));
    }
}

/// <summary>
/// Every field is optional; one that is absent stays as it is. <c>settings</c> replaces the round's whole layer
/// (the app sends the full layer of tela 20), and <c>{}</c> clears it. Unknown fields are a 400 (ADR 0039).
/// </summary>
internal sealed record UpdateRoundRequest(string? LocalDate, string? LocalTime, string? Venue, JsonElement? Settings);
