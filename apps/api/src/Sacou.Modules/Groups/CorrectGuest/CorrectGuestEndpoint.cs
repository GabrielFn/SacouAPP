using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.CorrectGuest;

/// <summary>
/// <c>PATCH /v1/groups/{groupId}/guests/{memberId}</c> <c>{ name?, primaryPosition? }</c>: the right to correct the
/// data of someone without an account (ADR 0053, D9). At least one field; <c>primaryPosition: null</c> clears it. A
/// member with an account, removed or of another group is the same 404 <c>groups.member-not-found</c>. The response
/// carries the name, so no cache along the way keeps it.
/// </summary>
internal static class CorrectGuestEndpoint
{
    public const string Name = "CorrectGuest";
    public const string Route = "/guests/{memberId:guid}";

    private const string NoStore = "no-store";

    public static RouteGroupBuilder MapCorrectGuest(this RouteGroupBuilder group)
    {
        group.MapPatch(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageGuests)
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return group;
    }

    private static async Task<Results<Ok<GuestResponse>, ProblemHttpResult>> HandleAsync(
        Guid memberId, CorrectGuestRequest request, HttpContext context, IGroupStore store, CancellationToken cancellationToken)
    {
        context.Response.Headers[HeaderNames.CacheControl] = NoStore;
        var correction = ReadCorrection(request);
        if (correction.IsFailure)
        {
            return ProblemResults.From(correction.Error);
        }

        var access = context.GroupAccess();
        var target = new MemberId(memberId);
        var changed = await store.ExecuteInGroupLockAsync(
            access.GroupId, group => group.CorrectGuest(access.Member.Id, target, correction.Value), cancellationToken).ConfigureAwait(false);
        return changed.ToHttpResult(change => TypedResults.Ok(GuestResponse.From(change.Group.Guests.Single(guest => guest.MemberId == target))));
    }

    /// <summary>An absent field keeps its value. The name must be text; the position text or null; an empty body is <c>groups.guest-invalid</c>.</summary>
    private static Result<GuestCorrection> ReadCorrection(CorrectGuestRequest request)
    {
        GuestName? name = null;
        if (request.Name.ValueKind != JsonValueKind.Undefined)
        {
            var created = GuestName.Create(request.Name.ValueKind == JsonValueKind.String ? request.Name.GetString() : null);
            if (created.IsFailure)
            {
                return Result.Failure<GuestCorrection>(created.Error);
            }

            name = created.Value;
        }

        if (!TryReadPosition(request.PrimaryPosition, out var position))
        {
            return Result.Failure<GuestCorrection>(GroupErrors.GuestInvalid);
        }

        var correction = new GuestCorrection(name, request.PrimaryPosition.ValueKind != JsonValueKind.Undefined, position);
        return correction.IsEmpty ? Result.Failure<GuestCorrection>(GroupErrors.GuestInvalid) : Result.Success(correction);
    }

    /// <summary>Absent or null: no position. Text: one of the five. Anything else: refused.</summary>
    private static bool TryReadPosition(JsonElement field, out GuestPosition? position)
    {
        position = null;
        if (field.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return true;
        }

        var parsed = field.ValueKind == JsonValueKind.String ? GuestPositions.Parse(field.GetString()) : null;
        if (parsed is not { IsSuccess: true })
        {
            return false;
        }

        position = parsed.Value;
        return true;
    }
}

/// <summary>Only the two fields of the profile: a member id, a role or a level in the body is a 400 (ADR 0039).</summary>
internal sealed record CorrectGuestRequest(JsonElement Name, JsonElement PrimaryPosition);

/// <summary>The guest as corrected. The position uses the names of the player's profile.</summary>
internal sealed record GuestResponse(Guid MemberId, string Name, PlayingPosition? PrimaryPosition)
{
    public static GuestResponse From(Guest guest) => new(
        guest.MemberId.Value,
        guest.Profile.Name.Value,
        guest.Profile.Position is { } position ? ContractValues.ToContract(position) : null);
}
