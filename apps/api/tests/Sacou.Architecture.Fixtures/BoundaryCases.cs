namespace Foo.Domain
{
    internal sealed class EscapedDomainType;
}

namespace Sacou.Api.Host
{
    internal sealed class ApiType;
}

namespace Sacou.Modules.Beta
{
    internal static class BetaModule
    {
        internal static int Register() => 0;
    }
}

namespace Sacou.Modules.Beta.Contracts
{
    internal sealed record BetaPublished(Guid Id);
}

namespace Sacou.Modules.Beta.Domain
{
    internal sealed class BetaAggregate;
}

namespace Sacou.Modules.Alpha.Boundary
{
    internal sealed class AllowedUsesBetaContracts
    {
        internal Sacou.Modules.Beta.Contracts.BetaPublished? Published { get; init; }
    }

    internal sealed class UsesBetaDomain
    {
        internal Sacou.Modules.Beta.Domain.BetaAggregate Create() => new();
    }

    internal sealed class UsesBetaModule
    {
        internal int Register() => Sacou.Modules.Beta.BetaModule.Register();
    }

    internal sealed class UsesApi
    {
        internal Sacou.Api.Host.ApiType Create() => new();
    }
}
