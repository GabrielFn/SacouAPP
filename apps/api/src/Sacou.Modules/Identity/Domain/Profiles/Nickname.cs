using Sacou.Shared.Results;
using Sacou.Shared.Text;

namespace Sacou.Modules.Identity.Domain.Profiles;

/// <summary>
/// What the group calls the person, the same in every group (ADR 0051, D1): trimmed and normalized to NFC,
/// 1 to 20 user-perceived characters (it fits the player card and the team chip) and at most 80 code points,
/// the database limit, with the rule of the group name (E3.2): nothing invisible, a zero-width joiner only
/// inside an emoji, at most 4 combining marks per character, some letter, number or symbol. Not unique: two
/// "João" may share a group. Personal data: never logged (docs/seguranca/dados-pessoais.md).
/// </summary>
internal sealed record Nickname
{
    public const int MaxLength = PersonName.MaxLength;
    public const int MaxCodePoints = PersonName.MaxCodePoints;

    private Nickname(string value) => Value = value;

    public string Value { get; }

    /// <summary>The rule is <see cref="PersonName"/>, shared with the guest's name (ADR 0053, D3).</summary>
    public static Result<Nickname> Create(string? value) =>
        PersonName.Normalize(value) is { } normalized
            ? Result.Success(new Nickname(normalized))
            : Result.Failure<Nickname>(ProfileErrors.NicknameInvalid);

    /// <summary>A nickname read back from the database: shown as stored, even if the rule tightened since.</summary>
    internal static Nickname FromStored(string stored)
    {
        ArgumentNullException.ThrowIfNull(stored);
        return new Nickname(stored);
    }

    /// <summary>Never print the nickname: it names a person.</summary>
    public override string ToString() => nameof(Nickname);
}
