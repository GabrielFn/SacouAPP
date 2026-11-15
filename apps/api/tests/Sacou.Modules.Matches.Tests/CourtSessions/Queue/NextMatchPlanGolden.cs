using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Modules.Matches.Tests.CourtSessions.Score;
using Sacou.Tests.Golden;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Queue;

/// <summary>
/// Port of <c>queue-golden.test.fixture.ts</c>: a case of <c>queue-plans.json</c> or <c>queue-modes.json</c>.
/// The state comes by the reader of <c>initialState</c>; the criterion, the inputs and the modes come as
/// received, as the screen or a hostile caller may send them. The outcome is written with <c>ok</c> first
/// and compared node by node, key order included (ADR 0033, D7).
/// </summary>
internal static class NextMatchPlanGolden
{
    private static readonly HashSet<string> CaseFields = ["id", "input", "expected"];

    private static readonly HashSet<string> InputFields =
        ["state", "criterion", "criterionInput", "playersPerTeam", "exitMode", "winnerExit", "winnerCriterionInput"];

    public static void AssertCase(IReadOnlyList<JsonElement> cases, string id)
    {
        var goldenCase = GoldenFile.SingleCase(cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var input = goldenCase.GetProperty("input");
        GoldenFile.AssertOnlyFields(input, InputFields, id);

        var planned = NextMatchPlanner.Plan(CourtSessionStateReader.Read(input.GetProperty("state")), Input(input));

        OrderedJsonAssert.Equal(goldenCase.GetProperty("expected"), writer =>
        {
            writer.WriteStartObject();
            writer.WriteBoolean("ok", planned.IsSuccess);
            if (planned.IsSuccess)
            {
                NextMatchPlanWriter.WriteFields(writer, planned.Value);
            }
            else
            {
                NextMatchPlanWriter.WriteErrorFields(writer, planned.Error);
            }

            writer.WriteEndObject();
        }, id);
    }

    public static NextMatchInput Input(JsonElement input) =>
        new(
            Raw(input, "criterion"),
            Raw(input, "criterionInput"),
            Raw(input, "playersPerTeam"),
            Raw(input, "exitMode"),
            Raw(input, "winnerExit"),
            Raw(input, "winnerCriterionInput"));

    private static RawValue Raw(JsonElement input, string key) => RawValueReader.Parse(input.GetProperty(key).GetRawText());
}
