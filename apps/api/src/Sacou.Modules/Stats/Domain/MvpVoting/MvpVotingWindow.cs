namespace Sacou.Modules.Stats.Domain.MvpVoting;

/// <summary>Where the MVP vote of a round stands at an instant (ADR 0072, D2).</summary>
internal enum MvpVotingState
{
    NotOpen,
    Open,
    Closed,
}

/// <summary>
/// The MVP vote opens when the round ends and closes <see cref="OpenHours"/> later: a half-open interval, so at the
/// very instant of <see cref="ClosesAt"/> it is already closed. An instant calculation (a change of hour does not move
/// it), computed on every read: no job runs at the close (ADR 0072, D2).
/// </summary>
internal sealed record MvpVotingWindow(DateTimeOffset OpensAt, DateTimeOffset ClosesAt)
{
    public const int OpenHours = 24;

    public static MvpVotingWindow From(DateTimeOffset roundEndsAt) => new(roundEndsAt, roundEndsAt.AddHours(OpenHours));

    public MvpVotingState StateAt(DateTimeOffset now)
    {
        if (now < OpensAt)
        {
            return MvpVotingState.NotOpen;
        }

        return now < ClosesAt ? MvpVotingState.Open : MvpVotingState.Closed;
    }
}
