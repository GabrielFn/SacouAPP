using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Domain.Users;

internal static class UserErrors
{
    public static readonly Error SubjectInvalid = new("identity.subject-invalid", ErrorKind.Validation);
}
