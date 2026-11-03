namespace Sacou.Modules.Matches.Domain.CourtSessions;

/// <summary>
/// The outcome of a court session rule, with an error that names a schema field. Local to this
/// folder, because the <c>Error</c> of Shared holds only a code and one module consumes it (ADR 0005).
/// </summary>
internal sealed class Result<TValue, TError>
    where TValue : notnull
    where TError : notnull
{
    private readonly TValue? _value;
    private readonly TError? _error;

    private Result(TValue? value, TError? error, bool isSuccess)
    {
        _value = value;
        _error = error;
        IsSuccess = isSuccess;
    }

    public bool IsSuccess { get; }

    public bool IsFailure => !IsSuccess;

    public TValue Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("A failed result has no value.");

    public TError Error => IsSuccess
        ? throw new InvalidOperationException("A successful result has no error.")
        : _error!;

    internal static Result<TValue, TError> Success(TValue value)
    {
        ArgumentNullException.ThrowIfNull(value);
        return new Result<TValue, TError>(value, default, isSuccess: true);
    }

    internal static Result<TValue, TError> Failure(TError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new Result<TValue, TError>(default, error, isSuccess: false);
    }

    /// <summary>Carries a failure over to another value type, as a TypeScript <c>Result&lt;never, E&gt;</c> does.</summary>
    internal Result<TOther, TError> Forward<TOther>()
        where TOther : notnull
        => Result<TOther, TError>.Failure(Error);

    /// <summary>Names only the outcome and the error, which never holds received content.</summary>
    public override string ToString() => IsSuccess ? "Success" : $"Failure({_error})";
}
