using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

internal sealed record PlayerRole
{
    public static readonly PlayerRole Setter = new("S");
    public static readonly PlayerRole Setter1 = new("S1");
    public static readonly PlayerRole Setter2 = new("S2");
    public static readonly PlayerRole Opposite = new("OPP");
    public static readonly PlayerRole OutsideHitter1 = new("OH1");
    public static readonly PlayerRole OutsideHitter2 = new("OH2");
    public static readonly PlayerRole MiddleBlocker1 = new("MB1");
    public static readonly PlayerRole MiddleBlocker2 = new("MB2");
    public static readonly PlayerRole Libero = new("L");
    public static readonly PlayerRole Player1 = new("P1");
    public static readonly PlayerRole Player2 = new("P2");
    public static readonly PlayerRole Player3 = new("P3");
    public static readonly PlayerRole Player4 = new("P4");
    public static readonly PlayerRole Player5 = new("P5");
    public static readonly PlayerRole Player6 = new("P6");

    public static readonly ImmutableArray<PlayerRole> All =
    [
        Setter,
        Setter1,
        Setter2,
        Opposite,
        OutsideHitter1,
        OutsideHitter2,
        MiddleBlocker1,
        MiddleBlocker2,
        Libero,
        Player1,
        Player2,
        Player3,
        Player4,
        Player5,
        Player6,
    ];

    private PlayerRole(string code) => Code = code;

    public string Code { get; }
}
