namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The cleanup of the reports of E6.6 (question 234): a report older than 180 days is deleted. The daily sweep of the
/// internal pump route (ADR 0069, D10 and D12) calls it, as it cleans its own tables; only ids are deleted, nothing is
/// logged about which.
/// </summary>
public interface IContentReportRetention
{
    Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken);
}
