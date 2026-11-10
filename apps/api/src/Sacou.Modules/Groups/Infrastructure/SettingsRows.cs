namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>A row of <c>groups.group_settings</c>. The jsonb is read only through the domain parser (ADR 0041).</summary>
internal sealed class GroupSettingsRow
{
    public required Guid GroupId { get; init; }

    public required short SchemaVersion { get; init; }

    public required string Settings { get; init; }

    public string? TemplateKey { get; init; }

    public Guid? SavedTemplateId { get; init; }

    public required DateTimeOffset UpdatedAt { get; init; }

    public required Guid UpdatedByMemberId { get; init; }
}

/// <summary>A row of <c>groups.saved_templates</c>: the name is free text that may name a person.</summary>
internal sealed class SavedTemplateRow
{
    public required Guid Id { get; init; }

    public required Guid GroupId { get; init; }

    public required string Name { get; init; }

    public required short SchemaVersion { get; init; }

    public required string Settings { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public required Guid CreatedByMemberId { get; init; }
}
