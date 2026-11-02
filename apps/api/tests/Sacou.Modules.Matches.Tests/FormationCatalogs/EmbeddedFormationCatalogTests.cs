using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.FormationCatalogs;
using Xunit;

namespace Sacou.Modules.Matches.Tests.FormationCatalogs;

public sealed class EmbeddedFormationCatalogTests
{
    private const int FormationCount = 13;

    [Fact]
    public void Load_ReadsEveryFormation()
    {
        var catalog = EmbeddedFormationCatalog.Load();

        Assert.Equal(FormationCount, FormationSystem.All.Sum(system => catalog.Systems[system].Rotations.Count));
    }

    [Fact]
    public void Load_WithoutTheResource_CitesItsName()
    {
        var failure = Assert.Throws<InvalidOperationException>(
            () => EmbeddedFormationCatalog.Load(typeof(FormationCatalog).Assembly, "missing.json"));

        Assert.Contains("missing.json", failure.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AddMatchesModule_RegistersTheCatalogAsASingleton()
    {
        using var provider = new ServiceCollection().AddMatchesModule().BuildServiceProvider();

        var catalog = provider.GetRequiredService<FormationCatalog>();

        Assert.Same(catalog, provider.GetRequiredService<FormationCatalog>());
    }
}
