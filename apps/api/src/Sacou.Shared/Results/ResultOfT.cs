namespace Sacou.Shared.Results;

public sealed class Result<T>
    where T : notnull
{
    private readonly T? _value;
    private readonly Error? _error;

    private Result(T? value, Error? error)
    {
        _value = value;
        _error = error;
    }

    public bool IsSuccess => _error is null;

    public bool IsFailure => !IsSuccess;

    public T Value => _error is null
        ? _value!
        : throw new InvalidOperationException("A failed result has no value.");

    public Error Error => _error ?? throw new InvalidOperationException("A successful result has no error.");

    public TOutput Match<TOutput>(Func<T, TOutput> onSuccess, Func<Error, TOutput> onFailure)
    {
        ArgumentNullException.ThrowIfNull(onSuccess);
        ArgumentNullException.ThrowIfNull(onFailure);
        return _error is null ? onSuccess(_value!) : onFailure(_error);
    }

    internal static Result<T> FromValue(T value)
    {
        ArgumentNullException.ThrowIfNull(value);
        return new Result<T>(value, null);
    }

    internal static Result<T> FromError(Error error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new Result<T>(default, error);
    }
}
