using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Shared.Tests;

public sealed class ResultTests
{
    private const string SuccessBranch = "success";
    private const string FailureBranch = "failure";
    private const int SampleValue = 7;

    private static readonly Error SampleError = new("session.full", ErrorKind.Conflict);

    [Fact]
    public void Match_OnSuccess_RunsSuccessBranch()
    {
        var branch = Result.Success().Match(() => SuccessBranch, _ => FailureBranch);

        Assert.Equal(SuccessBranch, branch);
    }

    [Fact]
    public void Match_OnFailure_RunsFailureBranchWithError()
    {
        var error = Result.Failure(SampleError).Match<Error?>(() => null, failure => failure);

        Assert.Same(SampleError, error);
    }

    [Fact]
    public void Error_OnSuccess_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => Result.Success().Error);
    }

    [Fact]
    public void Failure_WithNullError_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => Result.Failure(null!));
    }

    [Fact]
    public void Flags_ReflectOutcome()
    {
        Assert.True(Result.Success().IsSuccess);
        Assert.False(Result.Success().IsFailure);
        Assert.True(Result.Failure(SampleError).IsFailure);
        Assert.False(Result.Failure(SampleError).IsSuccess);
    }

    [Fact]
    public void GenericMatch_OnSuccess_RunsSuccessBranchWithValue()
    {
        var value = Result.Success(SampleValue).Match(success => success, _ => 0);

        Assert.Equal(SampleValue, value);
    }

    [Fact]
    public void GenericMatch_OnFailure_RunsFailureBranchWithError()
    {
        var error = Result.Failure<int>(SampleError).Match<Error?>(_ => null, failure => failure);

        Assert.Same(SampleError, error);
    }

    [Fact]
    public void Value_OnSuccess_ReturnsValueEvenWhenDefault()
    {
        Assert.Equal(0, Result.Success(0).Value);
    }

    [Fact]
    public void Value_OnFailure_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => Result.Failure<int>(SampleError).Value);
    }

    [Fact]
    public void GenericError_OnSuccess_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => Result.Success(SampleValue).Error);
    }

    [Fact]
    public void GenericFailure_WithNullError_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => Result.Failure<int>(null!));
    }

    [Fact]
    public void GenericSuccess_WithNullValue_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => Result.Success<string>(null!));
    }

    [Fact]
    public void GenericFlags_ReflectOutcome()
    {
        Assert.True(Result.Success(SampleValue).IsSuccess);
        Assert.True(Result.Failure<int>(SampleError).IsFailure);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Error_WithBlankCode_Throws(string code)
    {
        Assert.Throws<ArgumentException>(() => new Error(code, ErrorKind.Validation));
    }

    [Fact]
    public void Error_WithNullCode_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => new Error(null!, ErrorKind.Validation));
    }
}
