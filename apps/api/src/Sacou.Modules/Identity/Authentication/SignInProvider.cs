namespace Sacou.Modules.Identity.Authentication;

/// <summary>The only providers that create or open an account. No phone, anonymous or custom sign-in.</summary>
internal enum SignInProvider
{
    Password,
    Google,
    Apple,
}
