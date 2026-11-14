using Sacou.Modules.Sessions.Domain.Draw;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>
/// Brute force, written apart from the domain: every way to put the players on equal teams, honouring the locks.
/// Gives the smallest gap between the highest and the lowest team sum, or null when no split exists.
/// </summary>
internal static class DrawOracle
{
    public static int? BestSumGap(IReadOnlyList<DrawPlayer> playing, IReadOnlyList<DrawLock> locks, int teamCount, int teamSize)
    {
        var position = playing.Select((player, index) => (player.MemberId, index)).ToDictionary();
        var constraints = locks.Select(item => (First: position[item.First], Second: position[item.Second], item.Kind)).ToArray();
        var team = new int[playing.Count];
        var sums = new int[teamCount];
        var loads = new int[teamCount];
        int? best = null;

        void Visit(int player, int teamsUsed)
        {
            if (player == playing.Count)
            {
                if (constraints.All(item => (team[item.First] == team[item.Second]) == (item.Kind == DrawLockKind.Together)))
                {
                    var gap = sums.Max() - sums.Min();
                    best = best is { } current && current <= gap ? current : gap;
                }

                return;
            }

            for (var candidate = 0; candidate < Math.Min(teamsUsed + 1, teamCount); candidate++)
            {
                if (loads[candidate] == teamSize)
                {
                    continue;
                }

                team[player] = candidate;
                loads[candidate]++;
                sums[candidate] += playing[player].LevelTenths;
                Visit(player + 1, Math.Max(teamsUsed, candidate + 1));
                loads[candidate]--;
                sums[candidate] -= playing[player].LevelTenths;
            }
        }

        Visit(0, 0);
        return best;
    }
}
