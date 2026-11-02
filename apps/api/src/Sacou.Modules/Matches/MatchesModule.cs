using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Matches.FormationCatalogs;

namespace Sacou.Modules.Matches;

public static class MatchesModule
{
    /// <summary>Loads the catalog right here: with a corrupt one, the API does not start.</summary>
    public static IServiceCollection AddMatchesModule(this IServiceCollection services) =>
        services.AddSingleton(EmbeddedFormationCatalog.Load());
}
