using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>Where a new round link code comes from (ADR 0070, D1). Injected, so a test can make it repeat.</summary>
internal interface IRoundLinkCodeGenerator
{
    RoundLinkCode NewCode();
}
