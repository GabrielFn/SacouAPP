using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RoundLinks;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.ConfirmTeams;

/// <summary>
/// Publishes the teams under the round's lock (ADR 0043, D5; ADR 0078). Works with the draw on or off ("Montar times"):
/// only the modality's team size is read from the settings. The log holds ids and counts, never the lists.
/// </summary>
internal sealed class ConfirmTeamsHandler(RoundWriter writer, RoundShareLinks links, ILogger<ConfirmTeamsHandler> logger)
{
    private const string Confirmed = "confirmed";

    public async Task<Result<RoundResponse>> HandleAsync(
        RoundAccess access, RoundId id, ConfirmTeamsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        ArgumentNullException.ThrowIfNull(request);
        var teams = request.ToTeams();
        var reserves = request.ToReserves();
        var written = await writer.ExecuteAsync(
            access,
            id,
            GroupCapability.DrawTeams,
            context => context.Round.ConfirmTeams(
                teams, reserves, context.Group.ActiveIds, context.Group.ResolveStored(context.Round).Settings.Draw.PlayersPerTeam, context.Now),
            cancellationToken).ConfigureAwait(false);
        var result = written.IsSuccess ? Confirmed : written.Error.Code;
        var teamCount = teams.IsDefault ? 0 : teams.Length;
        var reserveCount = reserves.IsDefault ? 0 : reserves.Length;
        RoundLog.TeamsConfirmed(logger, access.GroupId.Value, id.Value, result, teamCount, reserveCount);
        return links.Respond(written, access);
    }
}
