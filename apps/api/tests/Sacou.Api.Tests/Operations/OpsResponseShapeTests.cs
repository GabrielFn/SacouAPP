using System.Reflection;
using Sacou.Api.Operations;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>
/// Criterion 13 of E7.2 (ADR 0085, D2): the answer is numbers, rates, instants, week dates, the environment's label and
/// the group's name (question 216), field by field. A new field fails here until it is read and listed.
/// </summary>
public sealed class OpsResponseShapeTests
{
    /// <summary>Written by hand: <c>Type.Property: type</c>, every record the answer reaches.</summary>
    private static readonly string[] Expected =
    [
        "OpsMetricsResponse.CachedUntil: DateTimeOffset",
        "OpsMetricsResponse.Environment: String",
        "OpsMetricsResponse.GeneratedAt: DateTimeOffset",
        "OpsMetricsResponse.Users: OpsUsers",
        "OpsUserWeek.Deleted: Int32",
        "OpsUserWeek.Registered: Int32",
        "OpsUserWeek.WeekStart: DateOnly",
        "OpsUsers.Deleted: Int32",
        "OpsUsers.Registered: Int32",
        "OpsUsers.Weeks: IReadOnlyList<OpsUserWeek>",
    ];

    /// <summary>The only strings: the environment's label and the group's name.</summary>
    private static readonly string[] AllowedStrings = ["OpsMetricsResponse.Environment", "OpsGateGroup.Name"];

    private static readonly HashSet<Type> Leaves =
        [typeof(int), typeof(long), typeof(double), typeof(double?), typeof(bool), typeof(DateTimeOffset), typeof(DateOnly), typeof(string)];

    [Fact]
    public void TheAnswer_HasOnlyTheListedFields()
    {
        var found = new SortedSet<string>(StringComparer.Ordinal);
        Walk(typeof(OpsMetricsResponse), found, []);

        Assert.Equal(Expected.Order(StringComparer.Ordinal), found);
    }

    [Fact]
    public void NoField_IsAnIdOrFreeText()
    {
        var found = new SortedSet<string>(StringComparer.Ordinal);
        Walk(typeof(OpsMetricsResponse), found, []);

        Assert.DoesNotContain(found, field => field.EndsWith(": Guid", StringComparison.Ordinal) || field.Contains("MemberId", StringComparison.Ordinal));
        Assert.All(
            found.Where(field => field.EndsWith(": String", StringComparison.Ordinal)),
            field => Assert.Contains(field.Split(':')[0], AllowedStrings));
    }

    private static void Walk(Type type, SortedSet<string> found, HashSet<Type> seen)
    {
        if (!seen.Add(type))
        {
            return;
        }

        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance).Where(property => property.Name != "EqualityContract"))
        {
            var propertyType = property.PropertyType;
            found.Add($"{type.Name}.{property.Name}: {NameOf(propertyType)}");
            if (Leaves.Contains(propertyType))
            {
                continue;
            }

            var element = propertyType.IsGenericType && propertyType.GetGenericTypeDefinition() == typeof(IReadOnlyList<>)
                ? propertyType.GetGenericArguments()[0]
                : propertyType;
            Assert.True(element.Namespace == typeof(OpsMetricsResponse).Namespace, $"{type.Name}.{property.Name} reaches {element.FullName}.");
            Walk(element, found, seen);
        }
    }

    private static string NameOf(Type type) =>
        Nullable.GetUnderlyingType(type) is { } inner ? NameOf(inner) + "?"
        : type.IsGenericType ? $"{type.Name.Split('`')[0]}<{string.Join(", ", type.GetGenericArguments().Select(NameOf))}>"
        : type.Name;
}
