namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The Groups' part of the operator's dashboard (E7.2, ADR 0085, D2): every group by its creation, with its name
/// (question 216). The id is only the key the dashboard joins the Sessions' counts by; it never leaves the API. No
/// member, no setting, nothing else of the group.
/// </summary>
public interface IGroupsMetrics
{
    Task<IReadOnlyList<CountedGroup>> ListAsync(CancellationToken cancellationToken);
}

/// <summary>One group, the oldest first.</summary>
public sealed record CountedGroup(Guid GroupId, string Name, DateTimeOffset CreatedAt);
