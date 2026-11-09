namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>Mensalista or avulso (<c>produto.md:287</c>). A guest without an account is always <see cref="DropIn"/>.</summary>
internal enum MemberType
{
    Regular,
    DropIn,
}
