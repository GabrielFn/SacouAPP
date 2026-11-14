namespace Sacou.Modules.Groups.Domain.Levels;

/// <summary>Against abuse: one batch fits in the 4 KB body of the group routes (about 65 bytes an item).</summary>
internal static class MemberLevelLimits
{
    public const int MaxBatch = 50;
}
