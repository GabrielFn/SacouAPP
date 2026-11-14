using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Guests;

/// <summary>What the admin types about a guest: the name and, optionally, the position (screen 21a).</summary>
internal sealed record GuestProfile(GuestName Name, GuestPosition? Position)
{
    /// <summary>The text as it came, on the rules: the name first, then the position, if any.</summary>
    public static Result<GuestProfile> Read(string? name, string? position)
    {
        var guestName = GuestName.Create(name);
        if (guestName.IsFailure)
        {
            return Result.Failure<GuestProfile>(guestName.Error);
        }

        if (position is null)
        {
            return Result.Success(new GuestProfile(guestName.Value, null));
        }

        var guestPosition = GuestPositions.Parse(position);
        return guestPosition.IsSuccess
            ? Result.Success(new GuestProfile(guestName.Value, guestPosition.Value))
            : Result.Failure<GuestProfile>(guestPosition.Error);
    }
}

/// <summary>
/// The profile of a member without an account (ADR 0053, D1 and D2), kept apart from the member so no read of
/// <c>groups.members</c> ever carries a name. <see cref="RequestId"/> makes the creation idempotent (D5) and never
/// leaves the server. No author, by minimization.
/// </summary>
internal sealed record Guest(MemberId MemberId, GuestProfile Profile, Guid RequestId, DateTimeOffset CreatedAt);
