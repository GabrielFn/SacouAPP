using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>A2 of E3.4: the Sessions never reads the <c>groups</c> schema.</summary>
public sealed class SchemaIsolationTests
{
    [Fact]
    public void SessionsSource_NeverNamesTheGroupsSchema()
    {
        var directory = Path.Combine(RepositoryFiles.ModulesDirectory, "Sessions");

        Assert.True(Directory.Exists(directory), "The Sessions module directory must exist for the rule to mean anything.");
        ViolationAssert.None(SchemaIsolationRules.ModuleViolations(directory));
    }

    /// <summary>An empty rule proves nothing: each way of reaching the schema is planted here and must be found.</summary>
    [Theory]
    [InlineData("SELECT id FROM groups.members WHERE group_id = 1")]
    [InlineData("select * from \"groups\".\"members\"")]
    [InlineData("SELECT 1 FROM sessions.rounds r JOIN groups.members m ON m.id = r.id")]
    [InlineData("UPDATE groups.members SET role = 'player'")]
    [InlineData("modelBuilder.HasDefaultSchema(\"groups\");")]
    [InlineData("builder.ToTable(\"members\", \"groups\");")]
    public void PlantedReadsOfTheGroupsSchema_AreFound(string source)
    {
        Assert.NotEmpty(SchemaIsolationRules.Violations("Planted.cs", source));
    }

    [Theory]
    [InlineData("SELECT id FROM sessions.rounds WHERE group_id = 1")]
    [InlineData("var members = await groups.LoadAsync(group, cancellationToken);")]
    [InlineData("using Sacou.Modules.Groups.Contracts;")]
    public void TheSessionsOwnSqlAndTheGroupsContract_AreNotViolations(string source)
    {
        Assert.Empty(SchemaIsolationRules.Violations("Clean.cs", source));
    }
}
