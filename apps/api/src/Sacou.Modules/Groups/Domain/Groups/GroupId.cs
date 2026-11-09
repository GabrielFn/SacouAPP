namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>UUID v7 made by the API with the injected clock. Not a secret: authorization protects a group, never its id (ADR 0040).</summary>
internal readonly record struct GroupId(Guid Value)
{
    public static GroupId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));
}
