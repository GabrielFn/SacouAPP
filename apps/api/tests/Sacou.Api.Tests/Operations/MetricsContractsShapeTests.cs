using System.Reflection;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>
/// Door 2 of E7.2 (ADR 0085, D2): every module's <c>*Metrics</c> contract gives back numbers, dates and instants only.
/// The one id is the group's, the key the dashboard joins the Sessions' counts by; the one text is the group's name
/// (question 216). Never a member, a user, a subject or any other text.
/// </summary>
public sealed class MetricsContractsShapeTests
{
    private static readonly Type[] Contracts = [typeof(IIdentityMetrics), typeof(IGroupsMetrics), typeof(ISessionsMetrics)];

    private static readonly HashSet<Type> Numbers = [typeof(int), typeof(long), typeof(DateOnly), typeof(DateTimeOffset)];

    /// <summary><c>Type.Property</c> allowed to hold the group's id or its name.</summary>
    private static readonly string[] GroupKeys = ["CountedGroup.GroupId", "HeldWeek.GroupId"];

    private static readonly string[] GroupNames = ["CountedGroup.Name"];

    [Fact]
    public void EveryMetricsContract_GivesBackOnlyNumbers_TheGroupKeyAndItsName()
    {
        var fields = Contracts
            .SelectMany(contract => contract.GetMethods())
            .SelectMany(method => Fields(Unwrap(method.ReturnType), []))
            .ToList();

        Assert.NotEmpty(fields);
        Assert.All(fields, field =>
        {
            var allowed = Numbers.Contains(field.Type)
                || (field.Type == typeof(Guid) && GroupKeys.Contains(field.Name))
                || (field.Type == typeof(string) && GroupNames.Contains(field.Name));
            Assert.True(allowed, $"{field.Name} is {field.Type.Name}: a *Metrics contract gives back numbers only.");
        });
    }

    [Fact]
    public void EveryModuleMetricsContract_IsListedHere()
    {
        var found = typeof(IIdentityMetrics).Assembly.GetTypes()
            .Concat(typeof(IGroupsMetrics).Assembly.GetTypes())
            .Concat(typeof(ISessionsMetrics).Assembly.GetTypes())
            .Where(type => type.IsInterface && type.IsPublic && type.Name.EndsWith("Metrics", StringComparison.Ordinal));

        Assert.Equal(Contracts.Select(type => type.Name).Order(StringComparer.Ordinal), found.Select(type => type.Name).Distinct().Order(StringComparer.Ordinal));
    }

    private static Type Unwrap(Type type) =>
        type.IsGenericType && (type.GetGenericTypeDefinition() == typeof(Task<>) || type.GetGenericTypeDefinition() == typeof(IReadOnlyList<>))
            ? Unwrap(type.GetGenericArguments()[0])
            : type;

    private static IEnumerable<(string Name, Type Type)> Fields(Type type, HashSet<Type> seen)
    {
        if (!seen.Add(type))
        {
            yield break;
        }

        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            var propertyType = Unwrap(property.PropertyType);
            if (propertyType.Namespace?.StartsWith("Sacou.", StringComparison.Ordinal) == true)
            {
                foreach (var inner in Fields(propertyType, seen))
                {
                    yield return inner;
                }
            }
            else
            {
                yield return ($"{type.Name}.{property.Name}", propertyType);
            }
        }
    }
}
