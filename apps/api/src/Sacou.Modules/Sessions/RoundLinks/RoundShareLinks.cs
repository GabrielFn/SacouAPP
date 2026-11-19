using Microsoft.Extensions.Options;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// The round's public link, <c>{PublicBaseUrl}/r/{code}</c>, for the round's <c>shareUrl</c> (ADR 0070, D1). Only for
/// whoever may manage rounds (Admin and Co-admin): the link puts people in the group, and inviting is theirs (question
/// 130). Null for everyone else, for a round without a code, and in Development without a base.
/// </summary>
internal sealed class RoundShareLinks(IOptions<RoundPageOptions> options, IGroupMembership membership)
{
    public const string PagePath = "/r/";

    public bool MayShare(GroupRole role) => membership.Allows(role, GroupCapability.ManageRounds);

    public string? For(Round round, GroupRole role)
    {
        ArgumentNullException.ThrowIfNull(round);
        var origin = options.Value.BaseUri;
        return origin is null || round.LinkCode is not { } code || !MayShare(role)
            ? null
            : new Uri(origin, PagePath + code.Value).AbsoluteUri;
    }

    /// <summary>A written round as the screens read it, for the caller, with the link the caller may see.</summary>
    public Result<RoundResponse> Respond(Result<RoundOutcome> written, RoundAccess access)
    {
        ArgumentNullException.ThrowIfNull(written);
        ArgumentNullException.ThrowIfNull(access);
        return written.IsFailure
            ? Result.Failure<RoundResponse>(written.Error)
            : Result.Success(Attach(written.Value.ToResponse(access.MemberId), written.Value.Change.Round, access.Role));
    }

    /// <summary>The response with the link <paramref name="role"/> may see.</summary>
    public RoundResponse Attach(RoundResponse response, Round round, GroupRole role)
    {
        ArgumentNullException.ThrowIfNull(response);
        return response with { ShareUrl = For(round, role) };
    }
}
