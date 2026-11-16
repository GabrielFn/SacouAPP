import type { GroupSettings, SettingsPath, SettingsValue } from "@sacou/match-engine";

import type { Round, UpdateRoundBody } from "../../../services/api/sacou-api";
import { leafLayer, leafOf } from "../../groups/model/settings-patch";
import {
  PERSONALIZE_PATHS,
  type CreateRoundState,
  type PersonalizePath,
  type RoundLayer,
} from "./create-round.reducer";
import { normalizeVenue, roundLayerOf } from "./create-round.selectors";
import type { RoundSettingsView } from "./round-detail";

const ROUND_SOURCE = "round";

/** The capacity leaves the form rewrites from its field; the others of the round layer are kept as they are. */
const CAPACITY_PATHS: ReadonlySet<string> = new Set([
  "attendance.capacity",
  "attendance.capacityLimited",
]);

const PERSONALIZE: ReadonlySet<string> = new Set(PERSONALIZE_PATHS);

type Entry = readonly [SettingsPath, SettingsValue];

/** The leaves the round sets itself (source `round`), with their resolved value. */
function roundLeaves(view: RoundSettingsView): readonly Entry[] {
  return Object.entries(view.sources)
    .filter(([, source]) => source === ROUND_SOURCE)
    .flatMap(([path]): Entry[] => {
      const value = leafOf(view.values, path as SettingsPath);
      return value === undefined ? [] : [[path as SettingsPath, value]];
    });
}

function personalizeLayer(view: RoundSettingsView): RoundLayer {
  const leaves: Partial<Record<PersonalizePath, SettingsValue>> = Object.fromEntries(
    roundLeaves(view).filter(([path]) => PERSONALIZE.has(path)),
  );
  return leaves;
}

/**
 * The first state of "Editar rodada" (screen 20 with `?roundId=`): the round as the server has it. The
 * capacity field shows the round's own; "Repetir toda semana" does not apply to one round.
 */
export function editRoundState(
  group: GroupSettings,
  round: Round,
  view: RoundSettingsView,
): CreateRoundState {
  const layer = personalizeLayer(view);
  return {
    localDate: round.localDate,
    localTime: round.localTime,
    venue: round.venue,
    capacityText: group.attendance.enabled && round.capacity !== null ? String(round.capacity) : "",
    layer,
    repeatWeekly: false,
    personalizeOpen: Object.keys(layer).length > 0,
    sheet: { kind: "none" },
  };
}

/**
 * `PATCH` replaces the round's whole layer, so the body carries all of it: what the form edits plus the
 * round leaves it does not show. An emptied layer goes as `{}`, which clears it on the server.
 */
export function updateRoundRequest(
  group: GroupSettings,
  view: RoundSettingsView,
  state: CreateRoundState,
): UpdateRoundBody {
  const untouched = roundLeaves(view).filter(
    ([path]) => !PERSONALIZE.has(path) && !CAPACITY_PATHS.has(path),
  );
  const edited = roundLayerOf(group, state);
  const editedEntries = edited === null ? [] : layerEntriesOf(edited);
  const entries = [...untouched, ...editedEntries];
  return {
    localDate: state.localDate,
    localTime: state.localTime,
    venue: normalizeVenue(state.venue),
    settings: entries.length === 0 ? {} : leafLayer(entries),
  };
}

const SCHEMA_KEY = "schemaVersion";

function layerEntriesOf(layer: object): readonly Entry[] {
  return Object.entries(layer)
    .filter(([block]) => block !== SCHEMA_KEY)
    .flatMap(([block, leaves]) =>
      Object.entries(leaves as Readonly<Record<string, SettingsValue>>).map(
        ([leaf, value]): Entry => [`${block}.${leaf}` as SettingsPath, value],
      ),
    );
}
