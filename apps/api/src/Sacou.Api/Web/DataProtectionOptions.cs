using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace Sacou.Api.Web;

/// <summary>
/// <c>DataProtection:ContactEmail</c> (E6.4, question 250): the data protection contact's e-mail, shown on
/// <c>/excluir-conta</c> to ask without the app. Not a secret (it goes on a public page), never written in the code:
/// the GitHub variable <c>SACOU_DATA_PROTECTION_EMAIL</c> of each environment. Empty: the channel is not available yet.
/// </summary>
internal sealed class DataProtectionOptions
{
    public const string SectionName = "DataProtection";

    public string? ContactEmail { get; init; }

    /// <summary>The address in lower case, or null while it is not set. Valid by the time anyone reads it (on start).</summary>
    public string? NormalizedContactEmail =>
        string.IsNullOrWhiteSpace(ContactEmail) ? null : ContactEmail.Trim().ToLowerInvariant();
}

/// <summary>
/// On start (<c>ValidateOnStart</c>): a value that is not a plain e-mail stops the start in any environment, since it goes
/// into a <c>mailto:</c>; an empty one stops it only in Production, which never goes out without the channel the policy
/// and the Play ask for. The messages name the key, never the value.
/// </summary>
internal sealed partial class DataProtectionOptionsValidator(IHostEnvironment environment) : IValidateOptions<DataProtectionOptions>
{
    public const string Key = DataProtectionOptions.SectionName + ":" + nameof(DataProtectionOptions.ContactEmail);
    public const string NotAnEmail = Key + " must be an e-mail address.";
    public const string RequiredInProduction = Key + " is required in Production.";

    /// <summary>The longest address a mail server takes (RFC 5321, the path of 256 less the angle brackets).</summary>
    public const int MaxLength = 254;

    public ValidateOptionsResult Validate(string? name, DataProtectionOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (options.NormalizedContactEmail is not { } email)
        {
            return environment.IsProduction() ? ValidateOptionsResult.Fail(RequiredInProduction) : ValidateOptionsResult.Success;
        }

        return email.Length <= MaxLength && PlainEmail().IsMatch(email)
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(NotAnEmail);
    }

    /// <summary>
    /// Letters, digits and <c>. _ + -</c> before the <c>@</c>; a domain of at least two labels. Nothing that could end the
    /// attribute, add a header to the <c>mailto:</c> (<c>?</c>, <c>&amp;</c>, <c>%</c>) or a second address (<c>,</c>).
    /// </summary>
    [GeneratedRegex(@"^[a-z0-9._+-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", RegexOptions.CultureInvariant)]
    private static partial Regex PlainEmail();
}
