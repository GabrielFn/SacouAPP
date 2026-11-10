namespace Sacou.Modules.Groups.Domain.Templates;

/// <summary>UUID v7 made by the API with the injected clock. Always read together with the group id (ADR 0041).</summary>
internal readonly record struct TemplateId(Guid Value)
{
    public static TemplateId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));
}
