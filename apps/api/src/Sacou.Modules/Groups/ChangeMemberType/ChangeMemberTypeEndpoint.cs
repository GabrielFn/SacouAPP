using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using ContractType = Sacou.Modules.Groups.Contracts.MemberType;

namespace Sacou.Modules.Groups.ChangeMemberType;

/// <summary>
/// <c>PUT /v1/groups/{groupId}/members/{memberId}/type</c> <c>{ memberType }</c>: mensalista or avulso.
/// A guest without an account stays a drop-in (<c>groups.regular-needs-account</c>, from E3.5 on).
/// </summary>
internal static class ChangeMemberTypeEndpoint
{
    public const string Name = "ChangeMemberType";
    public const string Route = "/members/{memberId:guid}/type";

    public static RouteGroupBuilder MapChangeMemberType(this RouteGroupBuilder group)
    {
        group.MapPut(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ChangeMemberType);
        return group;
    }

    private static Task<Results<Ok<ChangeMemberTypeResponse>, ProblemHttpResult>> HandleAsync(
        Guid memberId, ChangeMemberTypeRequest request, HttpContext context, IGroupStore store, CancellationToken cancellationToken)
    {
        var type = ContractValues.ToDomain(request.MemberType);
        return GroupWrite.ExecuteAsync(
            context,
            store,
            (group, actor) => group.ChangeMemberType(actor, new MemberId(memberId), type),
            () => TypedResults.Ok(new ChangeMemberTypeResponse(memberId, request.MemberType)),
            cancellationToken);
    }
}

/// <summary>Only the type, and it must be there (ADR 0039).</summary>
internal sealed record ChangeMemberTypeRequest([property: JsonRequired] ContractType MemberType);

internal sealed record ChangeMemberTypeResponse(Guid MemberId, ContractType MemberType);
