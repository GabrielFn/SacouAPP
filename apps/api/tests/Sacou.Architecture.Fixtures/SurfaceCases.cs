namespace Sacou.Modules.Surface
{
    public static class SurfaceModule;

    public sealed class PublicLeak;
}

namespace Sacou.Modules.Surface.Contracts
{
    public sealed record SurfacePublished(Guid Id);
}

namespace Sacou.Modules.Surface.ContractsLookalike
{
    public sealed class PublicLookalikeLeak;
}

namespace Sacou.Modules.Surface.Hidden
{
    internal static class InternalOuter
    {
        public sealed class PublicNestedInInternal;
    }
}
