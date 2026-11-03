using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Queue;

/// <summary>The pure queue rules; their effect on the replay is covered by queue-events in the next part.</summary>
public sealed class QueueRulesTests
{
    private const string First = "b0000000-0000-4000-8000-000000000001";
    private const string Second = "b0000000-0000-4000-8000-000000000002";
    private const string Third = "b0000000-0000-4000-8000-000000000003";
    private const string OnCourt = "a0000000-0000-4000-8000-000000000001";

    private static readonly BySide<TeamRoster> Teams =
        new(new TeamRoster([OnCourt]), new TeamRoster(["a0000000-0000-4000-8000-000000000002"]));

    [Fact]
    public void Members_AreTheTeamsFirst_ThenThePlayers()
    {
        var queue = new TeamQueue([Third], [new TeamRoster([First]), new TeamRoster([Second])]);

        Assert.Equal([First, Second, Third], QueueRules.QueueMembers(queue));
        Assert.Equal(3, QueueRules.QueueSize(queue));
    }

    [Fact]
    public void EmptyQueue_HasNoMembers_AndOverlapsNobody()
    {
        Assert.Empty(QueueRules.QueueMembers(TeamQueue.Empty));
        Assert.False(QueueRules.IsQueueOverlappingTeams(TeamQueue.Empty, Teams));
    }

    [Fact]
    public void Overlap_IsAnyoneWaitingInATeamOnTheCourt_InPlayersOrTeams()
    {
        Assert.True(QueueRules.IsQueueOverlappingTeams(new TeamQueue([OnCourt], []), Teams));
        Assert.True(QueueRules.IsQueueOverlappingTeams(new TeamQueue([], [new TeamRoster([Teams.B.MemberIds[0]])]), Teams));
        Assert.False(QueueRules.IsQueueOverlappingTeams(new TeamQueue([First], [new TeamRoster([Second])]), Teams));
    }

    [Fact]
    public void Overlap_ComparesByCodeUnit()
    {
        Assert.False(QueueRules.IsQueueOverlappingTeams(new TeamQueue([OnCourt.ToUpperInvariant()], []), Teams));
    }
}
