namespace Sacou.Shared.Results;

/// <summary>
/// A business failure. <see cref="Code"/> is a stable constant, never user-facing text:
/// the pt-BR message lives in the centralized texts.
/// </summary>
public sealed record Error
{
    public Error(string code, ErrorKind kind)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        Code = code;
        Kind = kind;
    }

    public string Code { get; }

    public ErrorKind Kind { get; }
}
