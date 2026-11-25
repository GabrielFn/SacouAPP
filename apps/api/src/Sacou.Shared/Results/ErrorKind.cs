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

    /// <summary>The server cannot answer now and says when to try again (503 with <c>Retry-After</c>): the court snapshot builds are busy.</summary>
    Unavailable,
}
