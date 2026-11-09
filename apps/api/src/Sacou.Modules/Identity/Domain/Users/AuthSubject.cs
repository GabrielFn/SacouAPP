using System.Diagnostics.CodeAnalysis;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Domain.Users;

/// <summary>
/// The subject of a verified login: the Firebase UID. Case-sensitive, 1 to 128 visible ASCII
/// characters (the Firebase UID limit). Personal data: an online identifier (docs/seguranca/dados-pessoais.md).
/// </summary>
internal sealed record AuthSubject
{
    public const int MaxLength = 128;

    private const char FirstVisibleCharacter = '!';
    private const char LastVisibleCharacter = '~';

    private AuthSubject(string value) => Value = value;

    public string Value { get; }

    public static Result<AuthSubject> Create(string? value) =>
        IsValid(value)
            ? Result.Success(new AuthSubject(value))
            : Result.Failure<AuthSubject>(UserErrors.SubjectInvalid);

    /// <summary>Never print the UID: it identifies a person.</summary>
    public override string ToString() => nameof(AuthSubject);

    private static bool IsValid([NotNullWhen(true)] string? value) =>
        value is { Length: > 0 and <= MaxLength }
        && value.All(character => character is >= FirstVisibleCharacter and <= LastVisibleCharacter);
}
