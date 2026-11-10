namespace Sacou.Modules.Groups.Domain.Invites;

/// <summary>UUID v7, like every id of the module. Not the secret: the token is (ADR 0040, D10).</summary>
internal readonly record struct InviteId(Guid Value)
{
    public static InviteId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));
}
