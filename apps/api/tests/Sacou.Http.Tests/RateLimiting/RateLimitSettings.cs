using Microsoft.Extensions.Configuration;
using Sacou.Http.RateLimiting;

namespace Sacou.Http.Tests.RateLimiting;

/// <summary>A complete <c>RateLimiting</c> section in memory, every window the same unless a test changes one.</summary>
internal static class RateLimitSettings
{
    public static readonly IReadOnlyList<string> Sections =
        ["Global", "SignIn", "Invite", "GroupCreate", "InviteCreate", "Draw", "MemberLevels", "AccountExport", "AccountDelete", "CourtSync", "RoundLink", "PushDevice", "RoundPage", "Ops"];

    public static Dictionary<string, string?> Complete(int permitLimit = 3, int windowSeconds = 60)
    {
        var settings = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            [$"{RateLimitingOptions.SectionName}:DualConnectionConcurrency"] = "8",
            [$"{RateLimitingOptions.SectionName}:DualConnectionQueue"] = "16",
            [$"{RateLimitingOptions.SectionName}:DualConnectionHeadroom"] = "4",
            [$"{RateLimitingOptions.SectionName}:DualConnectionPerUser"] = "1",
            [$"{RateLimitingOptions.SectionName}:DualConnectionPerUserQueue"] = "4",
        };
        foreach (var section in Sections)
        {
            settings[$"{RateLimitingOptions.SectionName}:{section}:PermitLimit"] = permitLimit.ToString(System.Globalization.CultureInfo.InvariantCulture);
            settings[$"{RateLimitingOptions.SectionName}:{section}:WindowSeconds"] = windowSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        return settings;
    }

    public static IConfiguration Build(IReadOnlyDictionary<string, string?> settings) =>
        new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
}
