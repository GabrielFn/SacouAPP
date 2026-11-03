import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { VOLUME_TEST_TIMEOUT_MS } from "../event-log/volume-test-timeout.test.fixture.js";
import { SCORE_APPLIERS } from "./appliers.js";
import { parseScorePayload } from "./parse-payloads.js";
import {
  getMatchWinner,
  getSetPointTeams,
  getSetWinner,
  setsToWin,
  targetPointsForSet,
} from "./scoring-rules.js";
import type { CourtSessionState, ScoringRules, SetScore, SetsWon, TeamSide } from "./types.js";

interface RuleCase {
  readonly id: string;
  readonly scoring: ScoringRules;
  readonly setNumber: number;
  readonly score: SetScore;
  readonly setsWon?: SetsWon;
  readonly expected: {
    readonly targetPoints: number;
    readonly setsToWin: number;
    readonly setWinner: TeamSide | null;
    readonly setPointTeams: readonly TeamSide[];
    readonly matchWinner?: TeamSide | null;
  };
}

interface PayloadCase {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly expected: { readonly ok: true } | { readonly ok: false; readonly field: string };
}

interface EventCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected:
    | {
        readonly ok: true;
        readonly state: CourtSessionState;
        readonly activeEventIds: readonly string[];
      }
    | {
        readonly ok: false;
        readonly code: string;
        readonly eventId?: string;
        readonly field?: string;
      };
}

function readGolden(name: string): unknown {
  const url = new URL(`../../golden/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

const RULE_CASES = readGolden("score-rules.json") as readonly RuleCase[];
const PAYLOAD_CASES = readGolden("score-payloads.json") as readonly PayloadCase[];
const EVENT_CASES = readGolden("score-events.json") as readonly EventCase[];

const FORBIDDEN_NAMES = ["email", "name", "nickname", "phone", "pix", "photo", "userId"];
const STRANGE_KEYS = ["__proto__", "constructor", "1"];

/** Written by hand here, apart from the production shapes, so a dropped field fails the check. */
const SCHEMA_BY_TYPE: readonly {
  readonly type: string;
  readonly fields: readonly string[];
  readonly levels: readonly string[];
}[] = [
  {
    type: "MatchStarted",
    fields: [
      "matchId",
      "rulesVersion",
      "formationsVersion",
      "scoring",
      "scoring.bestOf",
      "scoring.pointsPerSet",
      "scoring.tieBreakPoints",
      "scoring.winMargin",
      "teams",
      "teams.a",
      "teams.a.memberIds",
      "teams.b",
      "teams.b.memberIds",
      "firstServer",
      "rotations",
      "rotations.a",
      "rotations.a.lineup",
      "rotations.a.setterZone",
      "rotations.a.system",
      "rotations.a.bench",
      "rotations.b",
      "rotations.b.lineup",
      "rotations.b.setterZone",
      "rotations.b.system",
      "rotations.b.bench",
    ],
    levels: [
      "root",
      "scoring",
      "teams",
      "teams.a",
      "teams.b",
      "rotations",
      "rotations.a",
      "rotations.b",
    ],
  },
  { type: "PointScored", fields: ["matchId", "setNumber", "team"], levels: ["root"] },
  {
    type: "SetEnded",
    fields: [
      "matchId",
      "setNumber",
      "winner",
      "nextSet",
      "nextSet.targetPoints",
      "nextSet.firstServer",
      "nextSet.setterZones",
      "nextSet.setterZones.a",
      "nextSet.setterZones.b",
    ],
    levels: ["root", "nextSet", "nextSet.setterZones"],
  },
  { type: "MatchEnded", fields: ["matchId", "endReason", "winner"], levels: ["root"] },
  {
    type: "LineupChanged",
    fields: ["matchId", "team", "lineup", "setterZone", "bench"],
    levels: ["root"],
  },
];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_RULE_IDS: readonly string[] = [
  "r1-0-0",
  "r1-24-22-set-point-a",
  "r1-25-22-a-wins",
  "r1-25-23-a-wins",
  "r1-22-25-b-wins",
  "r1-22-24-set-point-b",
  "r2-25-24-advantage-not-decided",
  "r2-24-24-no-set-point",
  "r2-26-24-a-wins",
  "r2-29-28-set-point-a",
  "r2-28-30-b-wins",
  "r3-no-advantage-25-24-a-wins",
  "r3-no-advantage-24-25-b-wins",
  "r3-no-advantage-24-24-both-set-point",
  "r3-no-advantage-24-23-set-point-a",
  "r4-single-set-ignores-tie-break",
  "r4-single-set-15-0-does-not-end",
  "r4-md3-set-1-regular",
  "r4-md3-set-2-regular",
  "r4-md3-set-3-tie-break",
  "r4-md5-set-1-regular",
  "r4-md5-set-2-regular",
  "r4-md5-set-3-regular",
  "r4-md5-set-4-regular",
  "r4-md5-set-5-tie-break",
  "r4-md3-tie-break-off",
  "r4-tie-break-above-points",
  "r5-tie-break-15-13-a-wins",
  "r5-tie-break-15-14-set-point-a",
  "r5-tie-break-14-14",
  "r5-tie-break-16-14-a-wins",
  "r5-set-2-15-13-does-not-end",
  "r6-target-1-m1-0-0-both-set-point",
  "r6-target-1-m1-1-0-a-wins",
  "r6-target-1-m2-0-0",
  "r6-target-1-m2-1-0-set-point-a",
  "r6-target-1-m2-1-1",
  "r6-target-1-m2-2-0-a-wins",
  "r7-md1-1-0-a",
  "r7-md1-0-1-b",
  "r7-md1-0-0-none",
  "r7-md3-1-0-none",
  "r7-md3-1-1-none",
  "r7-md3-2-0-a",
  "r7-md3-1-2-b",
  "r7-md5-2-2-none",
  "r7-md5-3-2-a",
  "r7-md5-2-3-b",
];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_EVENT_IDS: readonly string[] = [
  "g1-one-set-25-23-ends-the-match",
  "g2-best-of-3-ends-in-two-sets",
  "g2-point-after-the-end-is-rejected",
  "g3-second-set-keeps-the-regular-target",
  "g3-third-set-opens-with-the-tie-break-target",
  "g3-best-of-3-with-tie-break-a-wins",
  "g4-fourth-set-keeps-the-regular-target",
  "g4-fifth-set-opens-with-the-tie-break-target",
  "g4-best-of-5-a-wins-3-2",
  "g5-advantage-26-24-recorded-as-played",
  "g5-no-advantage-25-24-recorded-as-played",
  "g6-undo-the-first-point-goes-back-to-match-started",
  "g7-point-as-first-event",
  "g7-set-ended-as-first-event",
  "g7-match-ended-as-first-event",
  "g7-reverted-to-as-first-event",
  "g8-only-match-started",
  "g8-empty-log",
  "g9-frozen-copy-with-another-rules-version",
  "g10-revert-over-set-ended-reopens-the-set",
  "g10-play-goes-on-after-reopening-a-set",
  "g10-revert-over-match-ended-reopens-the-match",
  "g10-revert-over-both-reopens-the-last-set",
  "g11-undo-the-last-point-of-a-decided-set",
  "g12-second-match-starts-at-zero",
  "g12-finished-matches-keep-their-order",
  "g12-revert-to-the-end-of-the-first-match",
  "g13-match-started-with-a-match-open",
  "g13-match-id-repeated-while-open",
  "g13-match-id-repeated-after-it-finished",
  "g14-set-ended-at-10-8-is-applied-as-recorded",
  "g14-winner-behind-is-applied-as-recorded",
  "g14-next-target-against-the-rule-is-applied-as-recorded",
  "g14-match-end-against-the-sets-is-applied-as-recorded",
  "g15-point-with-another-match-id",
  "g15-point-with-another-set-number",
  "g15-late-point-of-a-closed-set",
  "g15-set-ended-with-another-match-id",
  "g15-set-ended-with-another-set-number",
  "g15-point-without-an-open-set",
  "g15-set-ended-without-an-open-set",
  "g15-sets-won-with-a-set-open",
  "g15-match-ended-with-another-match-id",
  "g15-next-set-past-the-format-in-one-set",
  "g15-next-set-past-the-format-in-best-of-3",
  "g16-manual-end-with-a-winner-keeps-the-partial",
  "g16-manual-end-without-a-winner-keeps-the-partial",
  "g16-manual-end-right-after-match-started",
  "g17-deciding-set-ended-without-match-ended",
  "g17-point-is-rejected-while-pending",
  "g17-match-ended-completes-the-pending-end",
  "g18-invalid-team-in-the-middle-of-the-log",
  "g18-personal-data-in-the-payload",
  "g18-proto-key-in-the-payload",
  "g18-set-ended-resent-is-ignored",
  "g18-unknown-type-still-fails-closed",
  "g19-200-finished-matches-are-accepted",
  "g19-match-started-after-200-finished-is-rejected",
];

/** Literal: the payload cases that `SCHEMA_BY_TYPE` does not describe. */
const EXPECTED_PAYLOAD_VALUE_IDS: readonly string[] = [
  "MatchStarted-extra-field",
  "MatchStarted-payload-is-null",
  "MatchStarted-payload-is-array",
  "MatchStarted-payload-is-text",
  "MatchStarted-payload-is-number",
  "MatchStarted-matchId-uppercase-uuid",
  "MatchStarted-matchId-email",
  "MatchStarted-matchId-name",
  "MatchStarted-matchId-uuid-with-newline",
  "MatchStarted-matchId-number",
  "MatchStarted-matchId-null",
  "PointScored-extra-field",
  "PointScored-payload-is-null",
  "PointScored-payload-is-array",
  "PointScored-payload-is-text",
  "PointScored-payload-is-number",
  "PointScored-matchId-uppercase-uuid",
  "PointScored-matchId-email",
  "PointScored-matchId-name",
  "PointScored-matchId-uuid-with-newline",
  "PointScored-matchId-number",
  "PointScored-matchId-null",
  "SetEnded-extra-field",
  "SetEnded-payload-is-null",
  "SetEnded-payload-is-array",
  "SetEnded-payload-is-text",
  "SetEnded-payload-is-number",
  "SetEnded-matchId-uppercase-uuid",
  "SetEnded-matchId-email",
  "SetEnded-matchId-name",
  "SetEnded-matchId-uuid-with-newline",
  "SetEnded-matchId-number",
  "SetEnded-matchId-null",
  "MatchEnded-extra-field",
  "MatchEnded-payload-is-null",
  "MatchEnded-payload-is-array",
  "MatchEnded-payload-is-text",
  "MatchEnded-payload-is-number",
  "MatchEnded-matchId-uppercase-uuid",
  "MatchEnded-matchId-email",
  "MatchEnded-matchId-name",
  "MatchEnded-matchId-uuid-with-newline",
  "MatchEnded-matchId-number",
  "MatchEnded-matchId-null",
  "MatchStarted-memberIds-item-uppercase-uuid",
  "MatchStarted-memberIds-b-item-uppercase-uuid",
  "MatchStarted-memberIds-item-email",
  "MatchStarted-memberIds-b-item-email",
  "MatchStarted-memberIds-item-name",
  "MatchStarted-memberIds-b-item-name",
  "MatchStarted-memberIds-item-uuid-with-newline",
  "MatchStarted-memberIds-b-item-uuid-with-newline",
  "MatchStarted-memberIds-item-number",
  "MatchStarted-memberIds-b-item-number",
  "MatchStarted-memberIds-item-null",
  "MatchStarted-memberIds-b-item-null",
  "MatchStarted-memberIds-empty",
  "MatchStarted-memberIds-25",
  "MatchStarted-memberIds-24",
  "MatchStarted-memberIds-repeated-in-team-a",
  "MatchStarted-memberIds-repeated-in-team-b",
  "MatchStarted-memberIds-repeated-between-teams",
  "MatchStarted-memberIds-not-an-array",
  "MatchStarted-teams-is-an-array",
  "MatchStarted-team-a-is-an-array",
  "MatchStarted-team-b-is-an-array",
  "MatchStarted-scoring-is-an-array",
  "MatchStarted-bestOf-1",
  "MatchStarted-bestOf-3",
  "MatchStarted-bestOf-5",
  "MatchStarted-bestOf-0",
  "MatchStarted-bestOf-2",
  "MatchStarted-bestOf-4",
  "MatchStarted-bestOf-7",
  "MatchStarted-bestOf-text-3",
  "MatchStarted-bestOf-null",
  "MatchStarted-winMargin-1",
  "MatchStarted-winMargin-2",
  "MatchStarted-winMargin-0",
  "MatchStarted-winMargin-3",
  "MatchStarted-winMargin-text-2",
  "MatchStarted-winMargin-null",
  "MatchStarted-pointsPerSet-1",
  "MatchStarted-pointsPerSet-99",
  "MatchStarted-pointsPerSet-0",
  "MatchStarted-pointsPerSet-100",
  "MatchStarted-pointsPerSet-1.5",
  "MatchStarted-pointsPerSet-negative",
  "MatchStarted-pointsPerSet-text",
  "MatchStarted-tieBreakPoints-1",
  "MatchStarted-tieBreakPoints-99",
  "MatchStarted-tieBreakPoints-0",
  "MatchStarted-tieBreakPoints-100",
  "MatchStarted-tieBreakPoints-1.5",
  "MatchStarted-tieBreakPoints-negative",
  "MatchStarted-tieBreakPoints-text",
  "MatchStarted-tieBreakPoints-null-is-off",
  "MatchStarted-pointsPerSet-null",
  "MatchStarted-rulesVersion-2",
  "MatchStarted-rulesVersion-max-safe",
  "MatchStarted-rulesVersion-0",
  "MatchStarted-rulesVersion-1.5",
  "MatchStarted-rulesVersion-text",
  "MatchStarted-rulesVersion-null",
  "MatchStarted-rulesVersion-above-safe",
  "MatchStarted-pointsPerSet-written-25.0",
  "MatchStarted-pointsPerSet-written-2.5e1",
  "MatchStarted-order-unknown-at-root-before-field",
  "MatchStarted-order-unknown-nested-before-field",
  "MatchStarted-order-matchId-first",
  "MatchStarted-order-rulesVersion-before-scoring",
  "MatchStarted-order-scoring-fields-before-teams",
  "PointScored-setNumber-1",
  "PointScored-setNumber-5",
  "PointScored-setNumber-0",
  "PointScored-setNumber-6",
  "PointScored-setNumber-1.5",
  "PointScored-setNumber-text",
  "PointScored-setNumber-null",
  "SetEnded-setNumber-1",
  "SetEnded-setNumber-5",
  "SetEnded-setNumber-0",
  "SetEnded-setNumber-6",
  "SetEnded-setNumber-1.5",
  "SetEnded-setNumber-text",
  "SetEnded-setNumber-null",
  "PointScored-team-b",
  "PointScored-team-uppercase-A",
  "PointScored-team-c",
  "PointScored-team-null",
  "PointScored-team-number",
  "SetEnded-winner-b",
  "SetEnded-winner-null",
  "SetEnded-winner-uppercase-A",
  "SetEnded-winner-c",
  "SetEnded-nextSet-null",
  "SetEnded-nextSet-empty-object",
  "SetEnded-nextSet-is-an-array",
  "SetEnded-nextSet-is-a-number",
  "SetEnded-targetPoints-1",
  "SetEnded-targetPoints-99",
  "SetEnded-targetPoints-0",
  "SetEnded-targetPoints-100",
  "SetEnded-targetPoints-1.5",
  "SetEnded-targetPoints-text",
  "SetEnded-targetPoints-null",
  "MatchEnded-sets-won-without-a-winner",
  "MatchEnded-sets-won-b",
  "MatchEnded-manual-with-a-winner",
  "MatchEnded-manual-without-a-winner",
  "MatchEnded-manual-without-the-winner-key",
  "MatchEnded-endReason-other",
  "MatchEnded-endReason-null",
  "MatchEnded-winner-uppercase-A",
  "MatchEnded-winner-c",
  "UnknownType-has-no-valid-payload",
  "MatchStarted-firstServer-b",
  "MatchStarted-firstServer-uppercase-A",
  "MatchStarted-firstServer-c",
  "MatchStarted-firstServer-null",
  "MatchStarted-firstServer-number",
  "MatchStarted-rotations-is-an-array",
  "MatchStarted-rotations-null",
  "MatchStarted-rotations-both-sides-off",
  "MatchStarted-rotations-a-off",
  "MatchStarted-rotations-b-off",
  "MatchStarted-rotations-a-is-an-array",
  "MatchStarted-rotations-a-is-a-number",
  "MatchStarted-rotations-a-empty-object",
  "MatchStarted-rotations-b-is-an-array",
  "MatchStarted-rotations-b-is-a-number",
  "MatchStarted-rotations-b-empty-object",
  "MatchStarted-lineup-5",
  "MatchStarted-lineup-7",
  "MatchStarted-lineup-0",
  "MatchStarted-lineup-not-an-array",
  "MatchStarted-lineup-null",
  "MatchStarted-lineup-repeated",
  "MatchStarted-lineup-item-uppercase-uuid",
  "MatchStarted-lineup-item-email",
  "MatchStarted-lineup-item-name",
  "MatchStarted-lineup-item-uuid-with-newline",
  "MatchStarted-lineup-item-number",
  "MatchStarted-lineup-item-null",
  "MatchStarted-lineup-member-outside-the-team",
  "MatchStarted-lineup-member-of-the-other-team",
  "MatchStarted-lineup-b-5",
  "MatchStarted-lineup-b-member-of-the-other-team",
  "MatchStarted-lineup-in-another-order-than-the-team",
  "MatchStarted-lineup-leaves-members-on-the-bench",
  "MatchStarted-setterZone-1",
  "MatchStarted-setterZone-6",
  "MatchStarted-setterZone-0",
  "MatchStarted-setterZone-7",
  "MatchStarted-setterZone-1.5",
  "MatchStarted-setterZone-text-1",
  "MatchStarted-setterZone-null",
  "MatchStarted-setterZone-b-0",
  "MatchStarted-setterZone-b-7",
  "MatchStarted-order-teams-before-firstServer",
  "MatchStarted-order-firstServer-before-rotations",
  "MatchStarted-order-rotations-a-before-b",
  "MatchStarted-order-lineup-before-setterZone",
  "MatchStarted-order-unknown-in-rotations-before-firstServer",
  "MatchStarted-rotation-at-the-root",
  "MatchStarted-lineup-at-the-root",
  "MatchStarted-setterZone-at-the-root",
  "SetEnded-nextSet-firstServer-a",
  "SetEnded-nextSet-firstServer-null",
  "SetEnded-nextSet-firstServer-uppercase-A",
  "SetEnded-setterZones-is-an-array",
  "SetEnded-setterZones-null",
  "SetEnded-setterZones-a-1",
  "SetEnded-setterZones-a-6",
  "SetEnded-setterZones-a-null",
  "SetEnded-setterZones-a-0",
  "SetEnded-setterZones-a-7",
  "SetEnded-setterZones-a-1.5",
  "SetEnded-setterZones-a-text-1",
  "SetEnded-setterZones-b-1",
  "SetEnded-setterZones-b-6",
  "SetEnded-setterZones-b-null",
  "SetEnded-setterZones-b-0",
  "SetEnded-setterZones-b-7",
  "SetEnded-setterZones-b-1.5",
  "SetEnded-setterZones-b-text-1",
  "SetEnded-order-targetPoints-before-firstServer",
  "SetEnded-order-firstServer-before-setterZones",
  "SetEnded-order-setterZones-a-before-b",
  "PointScored-sideOut-is-unknown",
  "PointScored-setterZone-is-unknown",
  "PointScored-servingTeam-is-unknown",
  "MatchStarted-formationsVersion-2",
  "MatchStarted-formationsVersion-max-safe",
  "MatchStarted-formationsVersion-0",
  "MatchStarted-formationsVersion-negative",
  "MatchStarted-formationsVersion-1.5",
  "MatchStarted-formationsVersion-text",
  "MatchStarted-formationsVersion-null",
  "MatchStarted-formationsVersion-above-safe",
  "MatchStarted-order-rulesVersion-before-formationsVersion",
  "MatchStarted-order-formationsVersion-before-scoring",
  "MatchStarted-system-5x1",
  "MatchStarted-system-6x2",
  "MatchStarted-system-4x2",
  "MatchStarted-system-livre",
  "MatchStarted-system-different-in-each-team",
  "MatchStarted-system-null",
  "MatchStarted-system-number",
  "MatchStarted-system-6x0",
  "MatchStarted-system-constructor",
  "MatchStarted-system-uppercase-LIVRE",
  "MatchStarted-system-array",
  "MatchStarted-system-b-null",
  "MatchStarted-system-b-number",
  "MatchStarted-system-b-6x0",
  "MatchStarted-system-b-constructor",
  "MatchStarted-order-setterZone-before-system",
  "MatchStarted-order-rotations-a-system-before-b",
  "MatchStarted-system-at-the-root",
  "MatchStarted-formationsVersion-in-a-rotation",
  "LineupChanged-extra-field",
  "LineupChanged-setNumber-is-unknown",
  "LineupChanged-system-is-unknown",
  "LineupChanged-payload-is-null",
  "LineupChanged-payload-is-array",
  "LineupChanged-payload-is-text",
  "LineupChanged-payload-is-number",
  "LineupChanged-matchId-uppercase-uuid",
  "LineupChanged-matchId-email",
  "LineupChanged-matchId-name",
  "LineupChanged-matchId-uuid-with-newline",
  "LineupChanged-matchId-number",
  "LineupChanged-matchId-null",
  "LineupChanged-team-b",
  "LineupChanged-team-uppercase-A",
  "LineupChanged-team-c",
  "LineupChanged-team-null",
  "LineupChanged-team-number",
  "LineupChanged-lineup-5",
  "LineupChanged-lineup-7",
  "LineupChanged-lineup-0",
  "LineupChanged-lineup-not-an-array",
  "LineupChanged-lineup-null",
  "LineupChanged-lineup-repeated",
  "LineupChanged-lineup-item-uppercase-uuid",
  "LineupChanged-lineup-item-email",
  "LineupChanged-lineup-item-number",
  "LineupChanged-lineup-item-null",
  "LineupChanged-setterZone-1",
  "LineupChanged-setterZone-6",
  "LineupChanged-setterZone-0",
  "LineupChanged-setterZone-7",
  "LineupChanged-setterZone-1.5",
  "LineupChanged-setterZone-text-1",
  "LineupChanged-setterZone-null",
  "LineupChanged-bench-empty",
  "LineupChanged-bench-18",
  "LineupChanged-bench-19",
  "LineupChanged-bench-not-an-array",
  "LineupChanged-bench-null",
  "LineupChanged-bench-repeated",
  "LineupChanged-bench-overlaps-the-lineup",
  "LineupChanged-bench-item-uppercase-uuid",
  "LineupChanged-bench-item-email",
  "LineupChanged-bench-item-number",
  "LineupChanged-bench-item-null",
  "LineupChanged-order-unknown-before-field",
  "LineupChanged-order-matchId-before-team",
  "LineupChanged-order-team-before-lineup",
  "LineupChanged-order-lineup-before-setterZone",
  "LineupChanged-order-setterZone-before-bench",
  "MatchStarted-bench-in-another-order-than-the-team",
  "MatchStarted-bench-18-with-24-members",
  "MatchStarted-bench-null",
  "MatchStarted-bench-not-an-array",
  "MatchStarted-bench-empty-with-members-left-out",
  "MatchStarted-bench-incomplete",
  "MatchStarted-bench-member-outside-the-team",
  "MatchStarted-bench-member-of-the-other-team",
  "MatchStarted-bench-overlaps-the-lineup",
  "MatchStarted-bench-repeated",
  "MatchStarted-bench-longer-than-the-team",
  "MatchStarted-bench-item-uppercase-uuid",
  "MatchStarted-bench-item-email",
  "MatchStarted-bench-item-number",
  "MatchStarted-bench-item-null",
  "MatchStarted-bench-19-with-24-members",
  "MatchStarted-bench-b-null",
  "MatchStarted-bench-b-with-a-member-of-the-other-team",
  "MatchStarted-order-system-before-bench",
  "MatchStarted-order-rotations-a-bench-before-b",
  "MatchStarted-bench-at-the-root",
];

function expectedPayloadMatrixIds(): readonly string[] {
  return SCHEMA_BY_TYPE.flatMap(({ type, fields, levels }) => [
    `${type}-valid`,
    ...fields.map((field) => `${type}-missing-${field}`),
    ...levels.flatMap((level) => [
      ...FORBIDDEN_NAMES.map((name) => `${type}-forbidden-${name}-at-${level}`),
      ...STRANGE_KEYS.map((key) => `${type}-key-${key}-at-${level}`),
    ]),
  ]);
}

function runEventCase({ courtSessionId, initialState, events }: EventCase) {
  const parsed: EventEnvelope[] = [];
  for (const raw of events) {
    const envelope = parseEventEnvelope(raw);
    if (!envelope.ok) {
      return { ok: false, ...envelope.error };
    }
    parsed.push(envelope.value);
  }
  const replayed = replayEvents({ courtSessionId, initialState, appliers: SCORE_APPLIERS }, parsed);
  return replayed.ok ? { ok: true, ...replayed.value } : { ok: false, ...replayed.error };
}

function integerShapedKeys(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return (value as readonly unknown[]).flatMap(integerShapedKeys);
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => [
    ...(/^\d+$/.test(key) ? [key] : []),
    ...integerShapedKeys(child),
  ]);
}

function expectUniqueIds(cases: readonly { readonly id: string }[]) {
  const ids = cases.map(({ id }) => id);
  expect(new Set(ids).size).toBe(ids.length);
}

function expectExactIds(cases: readonly { readonly id: string }[], expected: readonly string[]) {
  const ids = new Set(cases.map(({ id }) => id));
  const allowed = new Set(expected);
  expect({
    missing: expected.filter((id) => !ids.has(id)),
    unexpected: [...ids].filter((id) => !allowed.has(id)),
  }).toStrictEqual({ missing: [], unexpected: [] });
}

describe("score rules golden", () => {
  test.each(RULE_CASES)("$id", ({ scoring, setNumber, score, setsWon, expected }) => {
    const { bestOf, winMargin } = scoring;
    const targetPoints = targetPointsForSet(scoring, setNumber);

    expect(targetPoints).toBe(expected.targetPoints);
    expect(setsToWin(bestOf)).toBe(expected.setsToWin);
    expect(getSetWinner(score, targetPoints, winMargin)).toBe(expected.setWinner);
    expect(getSetPointTeams(score, targetPoints, winMargin)).toStrictEqual(expected.setPointTeams);
    if (setsWon !== undefined) {
      expect(getMatchWinner(setsWon, bestOf)).toBe(expected.matchWinner);
    }
  });

  test("case ids are unique", () => {
    expectUniqueIds(RULE_CASES);
  });

  test("has exactly the expected cases", () => {
    expectExactIds(RULE_CASES, EXPECTED_RULE_IDS);
  });
});

describe("score payloads golden", () => {
  test.each(PAYLOAD_CASES)("$id", ({ type, payload, expected }) => {
    const parsed = parseScorePayload(type, payload);

    if (expected.ok) {
      expect(parsed).toStrictEqual({ ok: true, value: payload });
    } else {
      expect(parsed).toStrictEqual({
        ok: false,
        error: { code: "invalid-payload", field: expected.field },
      });
    }
  });

  test("case ids are unique", () => {
    expectUniqueIds(PAYLOAD_CASES);
  });

  test("has exactly the expected cases", () => {
    expectExactIds(PAYLOAD_CASES, [...expectedPayloadMatrixIds(), ...EXPECTED_PAYLOAD_VALUE_IDS]);
  });

  describe.each(SCHEMA_BY_TYPE)("coverage of $type", ({ type, fields, levels }) => {
    const ids = new Set(PAYLOAD_CASES.map(({ id }) => id));

    test("has a valid minimum and a case for each missing field", () => {
      expect(ids).toContain(`${type}-valid`);
      expect(fields.filter((field) => !ids.has(`${type}-missing-${field}`))).toStrictEqual([]);
    });

    test("has a case for each forbidden name at each level", () => {
      const missing = levels.flatMap((level) =>
        FORBIDDEN_NAMES.filter((name) => !ids.has(`${type}-forbidden-${name}-at-${level}`)),
      );
      expect(missing).toStrictEqual([]);
    });

    test("has own strange keys at each level, kept by the JSON text", () => {
      const byId = new Map(PAYLOAD_CASES.map((goldenCase) => [goldenCase.id, goldenCase]));
      STRANGE_KEYS.forEach((key) => {
        const payload = byId.get(`${type}-key-${key}-at-root`)?.payload as object;
        expect(Object.keys(payload)).toContain(key);
      });
      const missing = levels.flatMap((level) =>
        STRANGE_KEYS.filter((key) => !ids.has(`${type}-key-${key}-at-${level}`)),
      );
      expect(missing).toStrictEqual([]);
    });
  });
});

describe("score events golden", () => {
  test.each(EVENT_CASES)(
    "$id",
    (goldenCase) => {
      const outcome = runEventCase(goldenCase);

      expect(outcome).toStrictEqual(goldenCase.expected);
      // Key order is part of the contract with the C# port.
      expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
    },
    VOLUME_TEST_TIMEOUT_MS,
  );

  test("case ids are unique", () => {
    expectUniqueIds(EVENT_CASES);
  });

  test("has exactly the expected cases", () => {
    expectExactIds(EVENT_CASES, EXPECTED_EVENT_IDS);
  });

  test("no expected state has an integer-shaped key, which JavaScript would reorder", () => {
    const offending = EVENT_CASES.flatMap(({ expected }) =>
      expected.ok ? integerShapedKeys(expected.state) : [],
    );
    expect(offending).toStrictEqual([]);
  });

  test("every expected state survives a JSON round trip", () => {
    EVENT_CASES.forEach(({ expected }) => {
      if (expected.ok) {
        expect(JSON.parse(JSON.stringify(expected.state))).toStrictEqual(expected.state);
      }
    });
  });
});
