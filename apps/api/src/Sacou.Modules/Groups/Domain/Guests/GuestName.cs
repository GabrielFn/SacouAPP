using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Shared.Results;
using Sacou.Shared.Text;

namespace Sacou.Modules.Groups.Domain.Guests;

/// <summary>
/// What the group calls a guest without an account (ADR 0053, D3): the rule of the nickname, shared in
/// <see cref="PersonName"/>. Not unique: two "Léo" may share a group. Personal data of someone who accepted no terms:
/// never logged, never in an event (docs/seguranca/dados-pessoais.md).
/// </summary>
internal sealed record GuestName
{
    private GuestName(string value) => Value = value;

    public string Value { get; }

    public static Result<GuestName> Create(string? value) =>
        PersonName.Normalize(value) is { } normalized
            ? Result.Success(new GuestName(normalized))
            : Result.Failure<GuestName>(GroupErrors.GuestNameInvalid);

    /// <summary>A name read back from the database: shown as stored, even if the rule tightened since.</summary>
    internal static GuestName FromStored(string stored)
    {
        ArgumentNullException.ThrowIfNull(stored);
        return new GuestName(stored);
    }

    /// <summary>Never print the name: it names a person.</summary>
    public override string ToString() => nameof(GuestName);
}
