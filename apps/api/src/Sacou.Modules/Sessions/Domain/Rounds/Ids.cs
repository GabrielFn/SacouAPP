namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>UUID v7 made by the API with the injected clock. Not a secret: authorization protects a round, never its id (ADR 0040).</summary>
internal readonly record struct RoundId(Guid Value)
{
    public static RoundId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));
}

/// <summary>The group a round belongs to. Sessions wraps the plain <see cref="Guid"/> the Groups contract gives (ADR 0040).</summary>
internal readonly record struct GroupId(Guid Value);

/// <summary>A weekly recurrence (<see cref="Series.RoundSeries"/>).</summary>
internal readonly record struct SeriesId(Guid Value)
{
    public static SeriesId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));
}
