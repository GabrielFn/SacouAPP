using DomainPlaying = Sacou.Modules.Identity.Domain.Profiles.PlayingPosition;
using DomainPrimary = Sacou.Modules.Identity.Domain.Profiles.PrimaryPosition;

namespace Sacou.Modules.Identity.Contracts;

/// <summary>Domain positions to the public ones and back, by name, so a new value without a twin fails loudly.</summary>
internal static class ProfileContractValues
{
    public static PlayingPosition ToContract(DomainPlaying position) => position switch
    {
        DomainPlaying.Setter => PlayingPosition.Setter,
        DomainPlaying.OutsideHitter => PlayingPosition.OutsideHitter,
        DomainPlaying.Opposite => PlayingPosition.Opposite,
        DomainPlaying.MiddleBlocker => PlayingPosition.MiddleBlocker,
        DomainPlaying.Libero => PlayingPosition.Libero,
        _ => throw new ArgumentOutOfRangeException(nameof(position), position, "Every position needs a public twin."),
    };

    public static PrimaryPosition ToContract(DomainPrimary position) => position switch
    {
        DomainPrimary.Any => PrimaryPosition.Any,
        DomainPrimary.Setter => PrimaryPosition.Setter,
        DomainPrimary.OutsideHitter => PrimaryPosition.OutsideHitter,
        DomainPrimary.Opposite => PrimaryPosition.Opposite,
        DomainPrimary.MiddleBlocker => PrimaryPosition.MiddleBlocker,
        DomainPrimary.Libero => PrimaryPosition.Libero,
        _ => throw new ArgumentOutOfRangeException(nameof(position), position, "Every main position needs a public twin."),
    };

    public static DomainPlaying ToDomain(PlayingPosition position) => position switch
    {
        PlayingPosition.Setter => DomainPlaying.Setter,
        PlayingPosition.OutsideHitter => DomainPlaying.OutsideHitter,
        PlayingPosition.Opposite => DomainPlaying.Opposite,
        PlayingPosition.MiddleBlocker => DomainPlaying.MiddleBlocker,
        PlayingPosition.Libero => DomainPlaying.Libero,
        _ => throw new ArgumentOutOfRangeException(nameof(position), position, "Every public position needs a domain twin."),
    };

    public static DomainPrimary ToDomain(PrimaryPosition position) => position switch
    {
        PrimaryPosition.Any => DomainPrimary.Any,
        PrimaryPosition.Setter => DomainPrimary.Setter,
        PrimaryPosition.OutsideHitter => DomainPrimary.OutsideHitter,
        PrimaryPosition.Opposite => DomainPrimary.Opposite,
        PrimaryPosition.MiddleBlocker => DomainPrimary.MiddleBlocker,
        PrimaryPosition.Libero => DomainPrimary.Libero,
        _ => throw new ArgumentOutOfRangeException(nameof(position), position, "Every public main position needs a domain twin."),
    };
}
