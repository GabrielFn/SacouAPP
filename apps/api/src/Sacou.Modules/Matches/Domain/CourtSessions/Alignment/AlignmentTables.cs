using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Alignment;

/// <summary>Which formation a zone of the lineup plays, and whether the pairs of that formation are swapped.</summary>
internal sealed record ZoneFormation(RotationKey FormationKey, bool SwapPairs);

/// <summary>Port of the alignment tables of <c>score/constants.data.ts</c> (ADR 0026).</summary>
internal static class AlignmentTables
{
    /// <summary>
    /// The <c>IRotationSystem</c> of ADR 0011: the systems differ only in data, so there is no class.
    /// The 6x2 and the 4x2 play three formations twice, with the pairs swapped. Keyed by setter zone.
    /// </summary>
    public static readonly ImmutableDictionary<FormationSystem, ImmutableDictionary<int, ZoneFormation>> ZoneFormations =
        ImmutableDictionary.CreateRange(
        [
            KeyValuePair.Create(FormationSystem.FiveOne, Zones(
                (1, RotationKey.One, false),
                (6, RotationKey.Six, false),
                (5, RotationKey.Five, false),
                (4, RotationKey.Four, false),
                (3, RotationKey.Three, false),
                (2, RotationKey.Two, false))),
            KeyValuePair.Create(FormationSystem.SixTwo, Zones(
                (1, RotationKey.One, false),
                (6, RotationKey.Six, false),
                (5, RotationKey.Five, false),
                (4, RotationKey.One, true),
                (3, RotationKey.Six, true),
                (2, RotationKey.Five, true))),
            KeyValuePair.Create(FormationSystem.FourTwo, Zones(
                (1, RotationKey.Four, false),
                (6, RotationKey.Three, false),
                (5, RotationKey.Two, false),
                (4, RotationKey.Four, true),
                (3, RotationKey.Three, true),
                (2, RotationKey.Two, true))),
            KeyValuePair.Create(FormationSystem.Livre, Zones(
                (1, RotationKey.Zero, false),
                (6, RotationKey.Zero, false),
                (5, RotationKey.Zero, false),
                (4, RotationKey.Zero, false),
                (3, RotationKey.Zero, false),
                (2, RotationKey.Zero, false))),
        ]);

    /// <summary>Only the label changes in a swap: the point stays the one of the formation.</summary>
    public static readonly ImmutableDictionary<PlayerRole, PlayerRole> SwappedPairRoles =
        ImmutableDictionary.CreateRange(
        [
            KeyValuePair.Create(PlayerRole.Setter1, PlayerRole.Setter2),
            KeyValuePair.Create(PlayerRole.Setter2, PlayerRole.Setter1),
            KeyValuePair.Create(PlayerRole.OutsideHitter1, PlayerRole.OutsideHitter2),
            KeyValuePair.Create(PlayerRole.OutsideHitter2, PlayerRole.OutsideHitter1),
            KeyValuePair.Create(PlayerRole.MiddleBlocker1, PlayerRole.MiddleBlocker2),
            KeyValuePair.Create(PlayerRole.MiddleBlocker2, PlayerRole.MiddleBlocker1),
        ]);

    /// <summary>
    /// Who sets, by role in the formation and before any swap: the 6x2 sets from the back row, the
    /// 4x2 from the net, and in the free system whoever stands in position 3.
    /// </summary>
    public static readonly ImmutableDictionary<FormationSystem, PlayerRole> ActingSetterRoles =
        ImmutableDictionary.CreateRange(
        [
            KeyValuePair.Create(FormationSystem.FiveOne, PlayerRole.Setter),
            KeyValuePair.Create(FormationSystem.SixTwo, PlayerRole.Setter1),
            KeyValuePair.Create(FormationSystem.FourTwo, PlayerRole.Setter2),
            KeyValuePair.Create(FormationSystem.Livre, PlayerRole.Player3),
        ]);

    /// <summary>The role of the libero in the formations, which a team with the libero off never shows.</summary>
    public static readonly PlayerRole LiberoRole = PlayerRole.Libero;

    private static ImmutableDictionary<int, ZoneFormation> Zones(
        params (int SetterZone, RotationKey FormationKey, bool SwapPairs)[] zones) =>
        zones.ToImmutableDictionary(zone => zone.SetterZone, zone => new ZoneFormation(zone.FormationKey, zone.SwapPairs));
}
