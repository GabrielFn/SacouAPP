using System.Text;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Results;
using Sacou.Shared.Text;

namespace Sacou.Modules.Sessions.Domain;

/// <summary>
/// Where the round happens: free text, 0 to 80 characters, trimmed and in NFC, nothing invisible. The same
/// rule family as <c>schedule.venue</c> (shared <see cref="DisplayText"/>). It may name a person: never
/// logged (docs/seguranca/dados-pessoais.md).
/// </summary>
internal sealed record Venue
{
    public static readonly Venue Empty = new(string.Empty);

    private Venue(string value) => Value = value;

    public string Value { get; }

    public static Result<Venue> Create(string? text)
    {
        var trimmed = (text ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return Result.Success(Empty);
        }

        if (!DisplayText.IsWellFormed(trimmed))
        {
            return Result.Failure<Venue>(RoundErrors.RoundInvalid);
        }

        var normalized = trimmed.Normalize(NormalizationForm.FormC);
        return DisplayText.IsAllowedName(normalized, SessionLimits.MaxVenueLength, SessionLimits.MaxVenueCodePoints, SessionLimits.MaxMarksPerCharacter)
            ? Result.Success(new Venue(normalized))
            : Result.Failure<Venue>(RoundErrors.RoundInvalid);
    }

    /// <summary>Read back from the database: shown as it is, never turned into an error.</summary>
    public static Venue FromStored(string stored)
    {
        ArgumentNullException.ThrowIfNull(stored);
        return new Venue(stored);
    }

    public override string ToString() => nameof(Venue);
}
