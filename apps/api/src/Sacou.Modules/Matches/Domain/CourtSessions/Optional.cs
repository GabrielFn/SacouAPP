namespace Sacou.Modules.Matches.Domain.CourtSessions;

/// <summary>
/// A value that may be absent, for a <see cref="Result{TValue, TError}"/> whose success can be
/// <c>null</c>, such as a team with the rotation off.
/// </summary>
internal sealed record Optional<T>(T? Value)
    where T : class
{
    public static readonly Optional<T> None = new(Value: null);

    public static Optional<T> Some(T value) => new(value);
}
