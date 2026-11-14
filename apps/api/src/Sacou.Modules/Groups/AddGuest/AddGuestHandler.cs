using System.Text.Json;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Shared.Levels;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.AddGuest;

/// <summary>The guest a request found or created: the member id, and whether this request created it (201) or a resend found it (200).</summary>
internal sealed record AddedGuest(MemberId MemberId, bool Created);

/// <summary>
/// Adds a guest without an account (ADR 0053): the body is read on the rules first (name, position, level), then the
/// aggregate decides under the group lock, so a resend, the member limit and a demotion are judged on what the
/// database says now. The level, when sent, is written in the same transaction.
/// </summary>
internal sealed class AddGuestHandler(IGroupStore store, TimeProvider time)
{
    public async Task<Result<AddedGuest>> HandleAsync(GroupId group, MemberId actor, AddGuestRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.RequestId == Guid.Empty)
        {
            return Result.Failure<AddedGuest>(GroupErrors.GuestInvalid);
        }

        var name = GuestName.Create(request.Name);
        if (name.IsFailure)
        {
            return Result.Failure<AddedGuest>(name.Error);
        }

        GuestPosition? position = null;
        if (request.PrimaryPosition is not null)
        {
            var parsed = GuestPositions.Parse(request.PrimaryPosition);
            if (parsed.IsFailure)
            {
                return Result.Failure<AddedGuest>(parsed.Error);
            }

            position = parsed.Value;
        }

        if (!TryReadLevel(request.Level, out var level))
        {
            return Result.Failure<AddedGuest>(GroupErrors.LevelInvalid);
        }

        var profile = new GuestProfile(name.Value, position);
        var now = time.GetUtcNow();
        var changed = await store.ExecuteInGroupLockAsync(
            group,
            locked =>
            {
                var admitted = locked.AddGuest(actor, request.RequestId, profile, level, now);
                return admitted.IsSuccess ? Result.Success(admitted.Value.Change) : Result.Failure<GroupChange>(admitted.Error);
            },
            cancellationToken).ConfigureAwait(false);
        if (changed.IsFailure)
        {
            return Result.Failure<AddedGuest>(changed.Error);
        }

        var guest = changed.Value.Group.Guests.Single(known => known.RequestId == request.RequestId);
        return Result.Success(new AddedGuest(guest.MemberId, Created: !changed.Value.ChangedGuests.IsEmpty));
    }

    /// <summary>Absent: no level row (pending, 3,0 in the draw). Null: "Não sei". A number on the scale: that level. Anything else: <c>groups.level-invalid</c>.</summary>
    private static bool TryReadLevel(JsonElement field, out GuestLevel? level)
    {
        level = null;
        switch (field.ValueKind)
        {
            case JsonValueKind.Undefined:
                return true;
            case JsonValueKind.Null:
                level = new GuestLevel(null);
                return true;
            case JsonValueKind.Number when field.TryGetDecimal(out var number) && SkillLevel.FromDecimal(number) is { IsSuccess: true } parsed:
                level = new GuestLevel(parsed.Value);
                return true;
            default:
                return false;
        }
    }
}
