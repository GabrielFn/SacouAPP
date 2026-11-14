using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Domain.Profiles;

/// <summary>Stable codes, listed in docs/dominio/perfil-e-nota.md. The app maps each one to its pt-BR text.</summary>
internal static class ProfileErrors
{
    public static readonly Error NicknameInvalid = new("identity.nickname-invalid", ErrorKind.Validation);

    /// <summary>A position or level rule failed. One code for all of them: the answer never says which field.</summary>
    public static readonly Error ProfileInvalid = new("identity.profile-invalid", ErrorKind.Validation);

    /// <summary>The person never saved a profile: the app opens screen 27.</summary>
    public static readonly Error ProfileNotFound = new("identity.profile-not-found", ErrorKind.NotFound);
}
