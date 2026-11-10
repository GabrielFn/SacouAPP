namespace Sacou.Modules.Groups.Infrastructure.InviteTokens;

/// <summary>Where a new invite token comes from. Injected, so a test can prove no handler makes one by itself.</summary>
internal interface IInviteTokenGenerator
{
    /// <summary>A new token, in the <see cref="InviteTokenFormat"/>. Shown once, in the response that creates the invite.</summary>
    string NewToken();
}
