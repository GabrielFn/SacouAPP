using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Http;
using Sacou.Modules.Groups;

// Own test project: allowed. Another module: not allowed.
[assembly: InternalsVisibleTo("Sacou.Architecture.Fixtures.Tests")]
[assembly: InternalsVisibleTo("Sacou.Modules.Beta")]

namespace Sacou.Architecture.Fixtures;

// Used as if this assembly were Sacou.Shared: it knows a module and ASP.NET, which Shared must not.
internal static class SharedViolations
{
    internal static readonly Type KnowsModule = typeof(GroupsModule);

    internal static readonly Type KnowsAspNet = typeof(HttpContext);
}
