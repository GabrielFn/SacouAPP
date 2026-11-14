using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;

namespace Sacou.Modules.Groups.AddGuest;

/// <summary>
/// <c>POST /v1/groups/{groupId}/guests</c> <c>{ requestId, name, primaryPosition?, level? }</c> (screen 21a): 201
/// <c>{ memberId }</c>, or 200 with the same member id when the same <c>requestId</c> comes again (ADR 0053, D5).
/// Admin and co-admin only. Putting the guest in a round is the attendance route, a second call under the round
/// lock (D4). The response never carries the name, the level or the request id.
/// </summary>
internal static class AddGuestEndpoint
{
    public const string Name = "AddGuest";
    public const string Route = "/guests";

    public static RouteGroupBuilder MapAddGuest(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageGuests)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return group;
    }

    private static async Task<Results<Created<AddGuestResponse>, Ok<AddGuestResponse>, ProblemHttpResult>> HandleAsync(
        AddGuestRequest request, HttpContext context, AddGuestHandler handler, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var added = await handler.HandleAsync(access.GroupId, access.Member.Id, request, cancellationToken).ConfigureAwait(false);
        if (added.IsFailure)
        {
            return ProblemResults.From(added.Error);
        }

        var body = new AddGuestResponse(added.Value.MemberId.Value);
        return added.Value.Created ? TypedResults.Created((string?)null, body) : TypedResults.Ok(body);
    }
}

/// <summary>
/// The request id (a UUID the app makes once per opening of screen 21a) and the name must be there; the position is
/// one of the five, and the level a JSON number on the scale or null for "Não sei" (ADR 0039, ADR 0053 D6).
/// </summary>
internal sealed record AddGuestRequest(
    [property: JsonRequired] Guid RequestId,
    [property: JsonRequired] string? Name,
    string? PrimaryPosition,
    JsonElement Level);

internal sealed record AddGuestResponse(Guid MemberId);
