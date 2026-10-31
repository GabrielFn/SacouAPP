namespace Sacou.Shared.Results;

public sealed class Result
{
    private static readonly Result SuccessInstance = new(null);

    private readonly Error? _error;

    private Result(Error? error) => _error = error;

    public bool IsSuccess => _error is null;

    public bool IsFailure => !IsSuccess;

    public Error Error => _error ?? throw new InvalidOperationException("A successful result has no error.");

    public static Result Success() => SuccessInstance;

    public static Result<T> Success<T>(T value)
        where T : notnull
        => Result<T>.FromValue(value);

    public static Result Failure(Error error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new Result(error);
    }

    public static Result<T> Failure<T>(Error error)
        where T : notnull
        => Result<T>.FromError(error);

    public TOutput Match<TOutput>(Func<TOutput> onSuccess, Func<Error, TOutput> onFailure)
    {
        ArgumentNullException.ThrowIfNull(onSuccess);
        ArgumentNullException.ThrowIfNull(onFailure);
        return _error is null ? onSuccess() : onFailure(_error);
    }
}
