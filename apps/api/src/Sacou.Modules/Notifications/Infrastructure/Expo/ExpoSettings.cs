using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Notifications.Application;

namespace Sacou.Modules.Notifications.Infrastructure.Expo;

/// <summary>
/// The Expo access token (ADR 0069, D11), read from <c>SACOU_EXPO_ACCESS_TOKEN</c> (Secret Manager in Cloud Run, a local
/// <c>.env</c> otherwise). With push security on in expo.dev, a stolen push token is useless without it. Missing, the
/// sending is off and the API runs: one warning per process, with the setting's name and never a value.
/// </summary>
internal sealed class ExpoSettings(IConfiguration configuration, ILogger<ExpoSettings> logger)
{
    public const string AccessTokenKey = "SACOU_EXPO_ACCESS_TOKEN";

    private readonly string accessToken = configuration[AccessTokenKey]?.Trim() ?? string.Empty;

    private int warned;

    public bool IsConfigured
    {
        get
        {
            if (accessToken.Length == 0 && Interlocked.Exchange(ref warned, 1) == 0)
            {
                NotificationLog.SendingOff(logger);
            }

            return accessToken.Length > 0;
        }
    }

    /// <summary>Only for the <c>Authorization</c> header of a request to Expo.</summary>
    public string AccessToken => accessToken;

    /// <summary>Never prints the token.</summary>
    public override string ToString() => $"ExpoSettings {{ IsConfigured = {accessToken.Length > 0} }}";
}
