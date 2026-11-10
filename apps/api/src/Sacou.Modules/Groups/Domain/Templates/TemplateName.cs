using System.Text;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Templates;

/// <summary>
/// The name an admin gives a saved template: the rule of <see cref="GroupName"/> with 40 characters.
/// Free text that may name a person: never logged (docs/seguranca/dados-pessoais.md).
/// </summary>
internal sealed record TemplateName
{
    public const int MaxLength = 40;
    public const int MaxCodePoints = 160;

    private TemplateName(string value) => Value = value;

    public string Value { get; }

    public static Result<TemplateName> Create(string? value)
    {
        var trimmed = value?.Trim();
        if (trimmed is null || !DisplayText.IsWellFormed(trimmed))
        {
            return Result.Failure<TemplateName>(GroupErrors.TemplateNameInvalid);
        }

        var normalized = trimmed.Normalize(NormalizationForm.FormC);
        return DisplayText.IsAllowedName(normalized, MaxLength, MaxCodePoints, GroupName.MaxMarksPerCharacter)
            ? Result.Success(new TemplateName(normalized))
            : Result.Failure<TemplateName>(GroupErrors.TemplateNameInvalid);
    }

    /// <summary>A name read back from the database: shown as it is, even if the rule tightened since.</summary>
    internal static TemplateName FromStored(string stored)
    {
        ArgumentNullException.ThrowIfNull(stored);
        return new TemplateName(stored);
    }

    public override string ToString() => nameof(TemplateName);
}
