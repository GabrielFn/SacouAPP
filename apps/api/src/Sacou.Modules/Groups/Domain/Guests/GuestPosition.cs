using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Guests;

/// <summary>The guest's position (screen 21a, "Posição · opcional"): one of the five concrete ones, never "Qualquer uma".</summary>
internal enum GuestPosition
{
    Setter,
    OutsideHitter,
    Opposite,
    MiddleBlocker,
    Libero,
}

/// <summary>
/// The text of each position, on the wire and in the database: the same camelCase names as the player's profile
/// (ADR 0051, D6), written by hand so renaming the enum never changes stored data.
/// </summary>
internal static class GuestPositions
{
    public static readonly ImmutableDictionary<GuestPosition, string> Names = ImmutableDictionary<GuestPosition, string>.Empty
        .Add(GuestPosition.Setter, "setter")
        .Add(GuestPosition.OutsideHitter, "outsideHitter")
        .Add(GuestPosition.Opposite, "opposite")
        .Add(GuestPosition.MiddleBlocker, "middleBlocker")
        .Add(GuestPosition.Libero, "libero");

    /// <summary>Case does not matter (ADR 0039); anything else, <c>any</c> included, is <c>groups.guest-invalid</c>.</summary>
    public static Result<GuestPosition> Parse(string? text)
    {
        foreach (var (position, name) in Names)
        {
            if (string.Equals(name, text, StringComparison.OrdinalIgnoreCase))
            {
                return Result.Success(position);
            }
        }

        return Result.Failure<GuestPosition>(GroupErrors.GuestInvalid);
    }
}
