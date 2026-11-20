using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Modules.Stats.GetRoundSummary;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Modules.Stats.Projections;
using Xunit;

namespace Sacou.Modules.Stats.Tests;

/// <summary>
/// 4.6 (a) and (d) of E3.9 (ADR 0047 and 0071): the hidden rating has no public type nor a field in an answer, and no
/// log call can take it. Each rule is first shown to catch a planted case, or it would prove nothing.
/// </summary>
public sealed partial class RatingSecrecyTests
{
    private static readonly Assembly Stats = typeof(StatsProjector).Assembly;

    /// <summary>The namespaces whose types reach a route or the export.</summary>
    private static readonly string[] AnswerNamespaces =
    [
        typeof(RoundSummaryReport).Namespace!,
        "Sacou.Modules.Stats.GetMyStats",
        "Sacou.Modules.Stats.AccountData",
    ];

    /// <summary>What may reach a log of the Stats: ids, counts, codes and times.</summary>
    private static readonly Type[] LoggableTypes = [typeof(Guid), typeof(int), typeof(long), typeof(bool), typeof(string)];

    [GeneratedRegex("^(mu|sigma|ordinal|skill)$|rating", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RatingName();

    [Fact]
    public void Rule_CatchesThePlantedRatingRow()
    {
        Assert.NotEmpty(RatingProperties(typeof(MemberRatingRow)));
        Assert.NotEmpty(RatingProperties(typeof(MemberRating)));
    }

    /// <summary>(a): no public type of the Stats, and no type of an answer, has a property named after the rating.</summary>
    [Fact]
    public void NoPublicTypeNorAnswer_HasARatingProperty()
    {
        var exposed = Stats.GetTypes()
            .Where(type => type.IsPublic || type.IsNestedPublic || AnswerNamespaces.Contains(type.Namespace))
            .ToList();

        Assert.Contains(typeof(RoundSummaryReport), exposed);
        Assert.Empty(exposed.SelectMany(type => RatingProperties(type).Select(property => $"{type.Name}.{property}")));
    }

    /// <summary>The rating types themselves stay internal: nothing outside the Stats can name them.</summary>
    [Fact]
    public void RatingTypes_AreInternal()
    {
        Assert.All([typeof(Skill), typeof(MemberRating), typeof(MemberRatingRow), typeof(RatingProjector), typeof(RatingPool)], type => Assert.False(type.IsPublic));
    }

    [Fact]
    public void LogRule_CatchesAPlantedRatingParameter()
    {
        Assert.NotEmpty(Violations(typeof(PlantedLog)));
    }

    /// <summary>(d): every log method of the Stats takes only ids, counts, codes and times, none named after the rating.</summary>
    [Fact]
    public void LogMethods_TakeNoRatingValue()
    {
        var logs = Stats.GetTypes().Where(HasLogMethods).ToList();

        Assert.Contains(typeof(StatsLog), logs);
        Assert.Empty(logs.SelectMany(Violations));
    }

    /// <summary>(d), by text: the Stats only logs through its <c>[LoggerMessage]</c> methods, never a bare <c>logger.Log…</c>.</summary>
    [Fact]
    public void StatsSources_LogOnlyThroughTheLogMethods()
    {
        var folder = Path.Combine(RepositoryRoot(), "apps", "api", "src", "Sacou.Modules", "Stats");
        var sources = Directory.GetFiles(folder, "*.cs", SearchOption.AllDirectories)
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .ToList();

        Assert.NotEmpty(sources);
        Assert.Empty(sources.Where(path => BareLogCall().IsMatch(File.ReadAllText(path))).Select(Path.GetFileName));
    }

    [GeneratedRegex(@"\.(Log|LogTrace|LogDebug|LogInformation|LogWarning|LogError|LogCritical)\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex BareLogCall();

    private static IEnumerable<string> RatingProperties(Type type) =>
        type.GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
            .Select(property => property.Name)
            .Where(name => RatingName().IsMatch(name));

    private static bool HasLogMethods(Type type) => LogMethods(type).Any();

    private static IEnumerable<MethodInfo> LogMethods(Type type) =>
        type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
            .Where(method => method.GetCustomAttribute<LoggerMessageAttribute>() is not null);

    private static IEnumerable<string> Violations(Type type) =>
        LogMethods(type).SelectMany(method => method.GetParameters()
            .Where(parameter => parameter.ParameterType != typeof(ILogger))
            .Where(parameter => !LoggableTypes.Contains(parameter.ParameterType) || RatingName().IsMatch(parameter.Name!))
            .Select(parameter => $"{type.Name}.{method.Name}({parameter.Name})"));

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Sacou.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("The repository root (Sacou.slnx) was not found.");
    }

    /// <summary>A log method that would leak: a double named after the rating.</summary>
    private static partial class PlantedLog
    {
        [LoggerMessage(Level = LogLevel.Information, Message = "Planted {Mu}.")]
        public static partial void Leak(ILogger logger, double mu);
    }
}
