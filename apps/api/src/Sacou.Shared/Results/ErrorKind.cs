namespace Sacou.Shared.Results;

public enum ErrorKind
{
    Validation,
    NotFound,
    Conflict,
    Forbidden,

    /// <summary>The resource existed and was deleted for good (410).</summary>
    Gone,

    /// <summary>Well formed, but a rule of the content refuses it (422): a court event the replay or a ceiling refuses.</summary>
    Unprocessable,
}
