using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Profiles;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.GetMyProfile;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Shared.Levels;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.SaveMyProfile;

/// <summary>
/// Registered user first, then the nickname, then the positions and the level; only a valid profile is written.
/// Nothing here logs: the nickname names a person (docs/seguranca/dados-pessoais.md).
/// </summary>
internal sealed class SaveMyProfileHandler(ICurrentUser currentUser, IPlayerProfileStore store, TimeProvider time)
{
    public async Task<Result<MyProfileResponse>> HandleAsync(SaveMyProfileRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<MyProfileResponse>(user.Error);
        }

        var profile = Build(new UserId(user.Value.UserId), request);
        if (profile.IsFailure)
        {
            return Result.Failure<MyProfileResponse>(profile.Error);
        }

        await store.UpsertAsync(profile.Value, cancellationToken).ConfigureAwait(false);
        return Result.Success(MyProfileResponse.From(profile.Value));
    }

    private Result<PlayerProfile> Build(UserId user, SaveMyProfileRequest request)
    {
        var nickname = Nickname.Create(request.Nickname);
        if (nickname.IsFailure)
        {
            return Result.Failure<PlayerProfile>(nickname.Error);
        }

        var positions = PlayerPositions.Create(
            request.PrimaryPosition is { } primary ? ProfileContractValues.ToDomain(primary) : null,
            request.OtherPositions?.Select(ProfileContractValues.ToDomain).ToList());
        if (positions.IsFailure)
        {
            return Result.Failure<PlayerProfile>(positions.Error);
        }

        var level = SuggestedLevel(request.SuggestedLevel);
        return level.IsFailure
            ? Result.Failure<PlayerProfile>(level.Error)
            : Result.Success(new PlayerProfile(user, nickname.Value, positions.Value, level.Value.Level, time.GetUtcNow()));
    }

    /// <summary>No level is a valid answer ("Não sei"); a level off the scale is <c>identity.profile-invalid</c>.</summary>
    private static Result<OptionalLevel> SuggestedLevel(decimal? value)
    {
        if (value is not { } number)
        {
            return Result.Success(new OptionalLevel(null));
        }

        var level = SkillLevel.FromDecimal(number);
        return level.IsSuccess
            ? Result.Success(new OptionalLevel(level.Value))
            : Result.Failure<OptionalLevel>(ProfileErrors.ProfileInvalid);
    }

    /// <summary>A Result needs a non-null value: the absent level travels inside this wrapper.</summary>
    private sealed record OptionalLevel(SkillLevel? Level);
}
