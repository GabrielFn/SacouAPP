using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;
using R = Sacou.Integration.Tests.Groups.SettingsRoute;

namespace Sacou.Integration.Tests.Groups;

/// <summary>The six settings and template routes of E3.3 (the seventh, `POST /v1/groups`, is in the E3.2 matrix).</summary>
public enum SettingsRoute
{
    GetSettings,
    PatchSettings,
    ApplyTemplate,
    ListTemplates,
    SaveTemplate,
    DeleteTemplate,
}

/// <summary>
/// M1 of E3.3: every actor on the six new routes, with the status and code written by hand from the permission
/// table (docs/dominio/grupos.md), never derived from the production table. Reading the settings is open to every
/// active member; everything else needs <c>ManageSettings</c>, which the admin and the co-admin hold (question 23).
/// No code means a success, or a 401 with no ProblemDetails code.
/// </summary>
internal static class SettingsAuthorizationMatrix
{
    private const string NotRegistered = "identity.user-not-registered";
    private const string NotFound = "groups.group-not-found";
    private const string Forbidden = "groups.forbidden";

    public static readonly TheoryData<A, R, int, string?> Rows = new()
    {
        { A.Admin, R.GetSettings, 200, null },
        { A.Admin, R.PatchSettings, 200, null },
        { A.Admin, R.ApplyTemplate, 200, null },
        { A.Admin, R.ListTemplates, 200, null },
        { A.Admin, R.SaveTemplate, 201, null },
        { A.Admin, R.DeleteTemplate, 204, null },

        { A.CoAdmin, R.GetSettings, 200, null },
        { A.CoAdmin, R.PatchSettings, 200, null },
        { A.CoAdmin, R.ApplyTemplate, 200, null },
        { A.CoAdmin, R.ListTemplates, 200, null },
        { A.CoAdmin, R.SaveTemplate, 201, null },
        { A.CoAdmin, R.DeleteTemplate, 204, null },

        { A.Scorekeeper, R.GetSettings, 200, null },
        { A.Scorekeeper, R.PatchSettings, 403, Forbidden },
        { A.Scorekeeper, R.ApplyTemplate, 403, Forbidden },
        { A.Scorekeeper, R.ListTemplates, 403, Forbidden },
        { A.Scorekeeper, R.SaveTemplate, 403, Forbidden },
        { A.Scorekeeper, R.DeleteTemplate, 403, Forbidden },

        { A.Player, R.GetSettings, 200, null },
        { A.Player, R.PatchSettings, 403, Forbidden },
        { A.Player, R.ApplyTemplate, 403, Forbidden },
        { A.Player, R.ListTemplates, 403, Forbidden },
        { A.Player, R.SaveTemplate, 403, Forbidden },
        { A.Player, R.DeleteTemplate, 403, Forbidden },

        { A.LeftMember, R.GetSettings, 404, NotFound },
        { A.LeftMember, R.PatchSettings, 404, NotFound },
        { A.LeftMember, R.ApplyTemplate, 404, NotFound },
        { A.LeftMember, R.ListTemplates, 404, NotFound },
        { A.LeftMember, R.SaveTemplate, 404, NotFound },
        { A.LeftMember, R.DeleteTemplate, 404, NotFound },

        { A.RemovedMember, R.GetSettings, 404, NotFound },
        { A.RemovedMember, R.PatchSettings, 404, NotFound },
        { A.RemovedMember, R.ApplyTemplate, 404, NotFound },
        { A.RemovedMember, R.ListTemplates, 404, NotFound },
        { A.RemovedMember, R.SaveTemplate, 404, NotFound },
        { A.RemovedMember, R.DeleteTemplate, 404, NotFound },

        { A.OutsiderMember, R.GetSettings, 404, NotFound },
        { A.OutsiderMember, R.PatchSettings, 404, NotFound },
        { A.OutsiderMember, R.ApplyTemplate, 404, NotFound },
        { A.OutsiderMember, R.ListTemplates, 404, NotFound },
        { A.OutsiderMember, R.SaveTemplate, 404, NotFound },
        { A.OutsiderMember, R.DeleteTemplate, 404, NotFound },

        { A.NonMember, R.GetSettings, 404, NotFound },
        { A.NonMember, R.PatchSettings, 404, NotFound },
        { A.NonMember, R.ApplyTemplate, 404, NotFound },
        { A.NonMember, R.ListTemplates, 404, NotFound },
        { A.NonMember, R.SaveTemplate, 404, NotFound },
        { A.NonMember, R.DeleteTemplate, 404, NotFound },

        { A.Unregistered, R.GetSettings, 403, NotRegistered },
        { A.Unregistered, R.PatchSettings, 403, NotRegistered },
        { A.Unregistered, R.ApplyTemplate, 403, NotRegistered },
        { A.Unregistered, R.ListTemplates, 403, NotRegistered },
        { A.Unregistered, R.SaveTemplate, 403, NotRegistered },
        { A.Unregistered, R.DeleteTemplate, 403, NotRegistered },

        { A.Anonymous, R.GetSettings, 401, null },
        { A.Anonymous, R.PatchSettings, 401, null },
        { A.Anonymous, R.ApplyTemplate, 401, null },
        { A.Anonymous, R.ListTemplates, 401, null },
        { A.Anonymous, R.SaveTemplate, 401, null },
        { A.Anonymous, R.DeleteTemplate, 401, null },
    };

    /// <summary>The request each route makes; `templateId` is a saved template of the world's group, for the delete.</summary>
    public static (HttpMethod Method, string Path, string? Json) Request(GroupWorld world, SettingsRoute route, Guid templateId) => route switch
    {
        R.GetSettings => (HttpMethod.Get, world.GroupPath + "/settings", null),
        R.PatchSettings => (HttpMethod.Patch, world.GroupPath + "/settings", """{"settings":{"schemaVersion":1,"scoring":{"bestOf":3}}}"""),
        R.ApplyTemplate => (HttpMethod.Post, world.GroupPath + "/settings/apply-template", """{"templateKey":"treino"}"""),
        R.ListTemplates => (HttpMethod.Get, world.GroupPath + "/templates", null),
        R.SaveTemplate => (HttpMethod.Post, world.GroupPath + "/templates", """{"name":"Meu modelo"}"""),
        R.DeleteTemplate => (HttpMethod.Delete, $"{world.GroupPath}/templates/{templateId}", null),
        _ => throw new ArgumentOutOfRangeException(nameof(route), route, "Every route needs a request."),
    };
}
