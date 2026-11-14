using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>"Travar dupla" puts two players on the same team; "separar" keeps them apart (docs/dominio/sorteio.md).</summary>
internal enum DrawLockKind
{
    Together,
    Apart,
}

/// <summary>A lock between two players of the teams. The pair has no order: A-B and B-A are the same lock.</summary>
internal sealed record DrawLock(MemberId First, MemberId Second, DrawLockKind Kind)
{
    public bool Involves(MemberId member) => First == member || Second == member;

    public bool SamePairAs(DrawLock other) =>
        (First == other.First && Second == other.Second) || (First == other.Second && Second == other.First);
}
