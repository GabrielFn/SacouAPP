using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Members;

namespace Sacou.Modules.Groups.CorrectGuest;

/// <summary>
/// <c>PUT /v1/groups/{groupId}/guests/{memberId}</c> <c>{ name, primaryPosition }</c>: the right to correct the data
/// of someone without an account (ADR 0053, D9). Both fields must be there, so the profile is replaced whole and
/// <c>primaryPosition: null</c> clears the position. A member with an account, removed or of another group is the
/// same 404 <c>groups.member-not-found</c>. The response carries the name, so no cache along the way keeps it.
/// </summary>
internal static class CorrectGuestEndpoint
{
    public const string Name = "CorrectGuest";
    public const string Route = "/guests/{memberId:guid}";

    private const string NoStore = "no-store";

    public static RouteGroupBuilder MapCorrectGuest(this RouteGroupBuilder group)
    {
        group.MapPut(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageGuests)
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return group;
    }

    private static async Task<Results<Ok<GuestResponse>, ProblemHttpResult>> HandleAsync(
        Guid memberId, CorrectGuestRequest request, HttpContext context, IGroupStore store, CancellationToken cancellationToken)
    {
        context.Response.Headers[HeaderNames.CacheControl] = NoStore;
        var profile = GuestProfile.Read(request.Name, request.PrimaryPosition);
        if (profile.IsFailure)
        {
            return ProblemResults.From(profile.Error);
        }

        var access = context.GroupAccess();
        var target = new MemberId(memberId);
        var changed = await store.ExecuteInGroupLockAsync(
            access.GroupId, group => group.CorrectGuest(access.Member.Id, target, profile.Value), cancellationToken).ConfigureAwait(false);
        return changed.ToHttpResult(change => TypedResults.Ok(GuestResponse.From(change.Group.Guests.Single(guest => guest.MemberId == target))));
    }
}

/// <summary>Both fields, always (ADR 0039): an absent one is a 400, a member id, a role or a level in the body too.</summary>
internal sealed record CorrectGuestRequest([property: JsonRequired] string? Name, [property: JsonRequired] string? PrimaryPosition);

/// <summary>The guest as corrected. The position uses the public enum of the player's profile.</summary>
internal sealed record GuestResponse(Guid MemberId, string Name, PlayingPosition? PrimaryPosition)
{
    public static GuestResponse From(Guest guest) => new(
        guest.MemberId.Value,
        guest.Profile.Name.Value,
        guest.Profile.Position is { } position ? ContractValues.ToContract(position) : null);
}
