using System.Reflection;
using Sacou.Modules.Groups;
using Sacou.Modules.Identity;
using Sacou.Modules.Matches;
using Sacou.Modules.Payments;
using Sacou.Modules.Sessions;
using Sacou.Modules.Stats;
using Sacou.Modules.Summaries;
using Sacou.Shared.Results;

namespace Sacou.Api.OpenApi;

/// <summary>
/// Every error code a module can put in an <c>ApiProblem</c>: the <c>static readonly Error</c> fields of its
/// <c>*Errors</c> classes (<c>GroupErrors</c>, <c>CurrentUserErrors</c>, <c>UserErrors</c>, and the ones to
/// come), sorted. A private error inside a calculator never reaches HTTP and stays out.
/// </summary>
internal static class ErrorCodeCatalog
{
    public const string ErrorsClassSuffix = "Errors";

    private const BindingFlags StaticFields = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.DeclaredOnly;

    public static readonly IReadOnlyList<Assembly> ModuleAssemblies =
    [
        typeof(IdentityModule).Assembly,
        typeof(GroupsModule).Assembly,
        typeof(SessionsModule).Assembly,
        typeof(MatchesModule).Assembly,
        typeof(PaymentsModule).Assembly,
        typeof(SummariesModule).Assembly,
        typeof(StatsModule).Assembly,
    ];

    public static IReadOnlyList<string> Codes() =>
        [.. ModuleAssemblies
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type => type.Name.EndsWith(ErrorsClassSuffix, StringComparison.Ordinal))
            .SelectMany(type => type.GetFields(StaticFields))
            .Where(field => field.IsInitOnly && field.FieldType == typeof(Error))
            .Select(field => ((Error)field.GetValue(null)!).Code)
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)];
}
