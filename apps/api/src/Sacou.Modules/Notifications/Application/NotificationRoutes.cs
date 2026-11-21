using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Notifications.Application;

/// <summary>The routes of the module, all under the caller's own <c>/v1/me</c>: no group id, no other person's id.</summary>
internal static class NotificationRoutes
{
    /// <summary>The installation id goes in the body, never in the path: a path reaches the hosting logs (ADR 0069, D8).</summary>
    public const string PushDevices = "/v1/me/push-devices";
    public const string RemovePushDevice = "/v1/me/push-devices/remove";
    public const string Notifications = "/v1/me/notifications";
    public const string ReadOne = "/v1/me/notifications/{notificationId:guid}/read";
    public const string ReadAll = "/v1/me/notifications/read-all";
}

/// <summary>The caller, and every member id they have or had: a notification is always read through them (ADR 0069, D7).</summary>
internal sealed record Recipient(Guid UserId, IReadOnlyList<Guid> Members);

internal sealed class Recipients(ICurrentUser currentUser, IGroupMembership membership)
{
    /// <summary>403 <c>identity.user-not-registered</c> before <c>POST /v1/me</c>, as every route of the person.</summary>
    public async Task<Result<Guid>> UserAsync(CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        return user.IsFailure ? Result.Failure<Guid>(user.Error) : Result.Success(user.Value.UserId);
    }

    public async Task<Result<Recipient>> CallerAsync(CancellationToken cancellationToken)
    {
        var user = await UserAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<Recipient>(user.Error);
        }

        var members = await membership.ListMemberIdsOfUserAsync(user.Value, cancellationToken).ConfigureAwait(false);
        return Result.Success(new Recipient(user.Value, members));
    }
}
