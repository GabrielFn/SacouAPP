using Xunit;

namespace Sacou.Tests.TestSupport;

/// <summary>
/// The one table of inputs for the rule of a person's name, run by the nickname test (Identity) and the guest name
/// test (Groups), so the two rules cannot drift apart (ADR 0053, D3; plan E3.5, R1). The limits are written as
/// literals on purpose: a test that read the constant would pass with any value.
/// </summary>
internal static class PersonNameCases
{
    // Built from code points: invisible characters must never sit literally in the source.
    private const int ZeroWidthSpace = 0x200B;
    private const int ZeroWidthJoiner = 0x200D;
    private const int RightToLeftOverride = 0x202E;
    private const int ByteOrderMark = 0xFEFF;
    private const int Woman = 0x1F469;
    private const int Laptop = 0x1F4BB;
    private const int CombiningAcute = 0x0301;
    private const int Smile = 0x1F600;

    /// <summary>One text element of seven code points: man, woman, girl, boy, joined.</summary>
    private static readonly string Family = Text(0x1F468, ZeroWidthJoiner, Woman, ZeroWidthJoiner, 0x1F467, ZeroWidthJoiner, 0x1F466);

    /// <summary>"x" never composes with the acute accent, so NFC keeps every mark.</summary>
    private static readonly string FourMarks = "x" + string.Concat(Enumerable.Repeat(Text(CombiningAcute), 4));

    public static TheoryData<string> Accepted { get; } = new()
    {
        "João",
        "Caio",
        "Bia 2",
        new string('a', 20),
        string.Concat(Enumerable.Repeat(Text(Smile), 20)),
        Family,
        // A family is one character but seven code points: 11 fit in 80.
        string.Concat(Enumerable.Repeat(Family, 11)),
        "Bia " + Text(Woman, ZeroWidthJoiner, Laptop),
        FourMarks,
    };

    /// <summary>Null is not here (theory data holds no null); each test checks it on its own.</summary>
    public static TheoryData<string> Refused { get; } = new()
    {
        string.Empty,
        "   ",
        new string('a', 21),
        string.Concat(Enumerable.Repeat(Family, 12)),
        FourMarks + Text(CombiningAcute),
        "Jo\nao",
        "Jo\tao",
        "Joao" + Text(0),
        "Jo" + Text(ZeroWidthSpace) + "ao",
        Text(ByteOrderMark) + "Joao",
        "Joao " + Text(RightToLeftOverride) + "oaj",
        "Jo" + Text(0x115F) + "ao",
        "Jo" + Text(0x1160) + "ao",
        "Jo" + Text(0x3164) + "ao",
        "Jo" + Text(0xFFA0) + "ao",
        "Jo" + Text(0x2800) + "ao",
        "Jo" + Text(ZeroWidthJoiner) + "ao",
        "Joao" + Text(0x0378),
        "Joao" + Text(0xE000),
        "...",
    };

    /// <summary>Not in a theory: a lone surrogate does not survive the serialization of theory data.</summary>
    public static string LoneSurrogate => "Joao" + (char)0xD800;

    /// <summary>"João" with the tilde as a combining mark; NFC stores it as one character.</summary>
    public static string DecomposedJoao => "Joa" + Text(0x0303) + "o";

    public static string Text(params int[] codePoints) => string.Concat(codePoints.Select(char.ConvertFromUtf32));
}
