using System.Collections.Immutable;
using System.Text.Json.Serialization;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.ConfirmTeams;

/// <summary>
/// The body of "Confirmar e compartilhar" (ADR 0078): the teams in order (1 is Laranja, 2 is Azul), each as member ids,
/// and the reserves in the order of the queue. Both required (no reserves is <c>[]</c>). Only ids: a field the record
/// does not declare, such as a level, is a 400 (ADR 0039).
/// </summary>
internal sealed record ConfirmTeamsRequest(
    [property: JsonRequired] IReadOnlyList<IReadOnlyList<Guid>?>? Teams,
    [property: JsonRequired] IReadOnlyList<Guid>? Reserves)
{
    /// <summary>A null where a list was expected becomes the default array, which the domain refuses as invalid.</summary>
    public ImmutableArray<ImmutableArray<MemberId>> ToTeams() => Teams is null || Teams.Any(team => team is null)
        ? default
        : [.. Teams.OfType<IReadOnlyList<Guid>>().Select(team => team.Select(member => new MemberId(member)).ToImmutableArray())];

    public ImmutableArray<MemberId> ToReserves() => Reserves is null ? default : [.. Reserves.Select(member => new MemberId(member))];

    /// <summary>Who plays with whom: never printed.</summary>
    public override string ToString() => nameof(ConfirmTeamsRequest);
}
