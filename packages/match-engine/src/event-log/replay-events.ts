import { err, ok, type Result } from "@sacou/volley-rules";

import { REVERTED_TO_EVENT_TYPE } from "./constants.data.js";
import { normalizeLog } from "./normalize-log.js";
import type {
  EventEnvelope,
  JsonObject,
  ReplayConfig,
  ReplayedState,
  ReplayedTimeline,
  ReplayError,
  ReplayErrorCode,
  TimelineEntry,
} from "./types.js";

/**
 * The active timeline: going back only moves the head, so states are never copied. Every node
 * walked by a revert leaves the timeline, which keeps the whole replay linear.
 */
interface TimelineNode<S> {
  readonly event: EventEnvelope;
  readonly state: S;
  readonly previous: TimelineNode<S> | null;
}

type Timeline<S> = TimelineNode<S> | null;

function failure(code: ReplayErrorCode, event: EventEnvelope): Result<never, ReplayError> {
  return err({ code, eventId: event.eventId });
}

function* walkTimeline<S>(head: Timeline<S>): Generator<TimelineNode<S>> {
  for (let node = head; node !== null; node = node.previous) {
    yield node;
  }
}

function findActiveNode<S>(head: Timeline<S>, eventId: string): Timeline<S> {
  for (const node of walkTimeline(head)) {
    if (node.event.eventId === eventId) {
      return node;
    }
  }
  return null;
}

function readRevertTarget(payload: JsonObject): string | null {
  const hasOnlyTarget =
    Object.keys(payload).length === 1 && Object.hasOwn(payload, "targetEventId");
  const { targetEventId } = payload;
  return hasOnlyTarget && typeof targetEventId === "string" ? targetEventId : null;
}

/**
 * Only active events are on the timeline, and only earlier ones so far. A target that is missing,
 * in the future, inactive or another `RevertedTo` is therefore simply not found.
 */
function revert<S>(head: Timeline<S>, event: EventEnvelope): Result<Timeline<S>, ReplayError> {
  const targetEventId = readRevertTarget(event.payload);
  const target = targetEventId === null ? null : findActiveNode(head, targetEventId);
  return target === null ? failure("invalid-revert-target", event) : ok(target);
}

function apply<S>(
  head: Timeline<S>,
  event: EventEnvelope,
  { initialState, appliers }: ReplayConfig<S>,
): Result<Timeline<S>, ReplayError> {
  const applier = appliers.get(event.type);
  if (applier === undefined) {
    return failure("unknown-event-type", event);
  }
  try {
    const applied = applier(head === null ? initialState : head.state, event);
    return applied.ok
      ? ok({ event, state: applied.value, previous: head })
      : failure("event-rejected", event);
  } catch {
    // Fails closed: the exception message could carry data, so it is not forwarded.
    return failure("event-rejected", event);
  }
}

function foldTimeline<S>(
  events: readonly EventEnvelope[],
  config: ReplayConfig<S>,
): Result<Timeline<S>, ReplayError> {
  return events.reduce<Result<Timeline<S>, ReplayError>>((outcome, event) => {
    if (!outcome.ok) {
      return outcome;
    }
    return event.type === REVERTED_TO_EVENT_TYPE
      ? revert(outcome.value, event)
      : apply(outcome.value, event, config);
  }, ok(null));
}

function toEntries<S>(head: Timeline<S>): readonly TimelineEntry<S>[] {
  return Array.from(walkTimeline(head), ({ event, state }) => ({ event, state })).reverse();
}

/**
 * Replays a stream like `replayEvents`, keeping the state right after each active event, in canonical
 * order. The states are the ones of the timeline, never copied, so it costs one reference per event.
 * The same limits and errors as `replayEvents` apply.
 */
export function replayTimeline<S>(
  config: ReplayConfig<S>,
  events: readonly EventEnvelope[],
): Result<ReplayedTimeline<S>, ReplayError> {
  const normalized = normalizeLog(events, config.courtSessionId);
  if (!normalized.ok) {
    return normalized;
  }
  const timeline = foldTimeline(normalized.value, config);
  return timeline.ok ? ok({ entries: toEntries(timeline.value) }) : timeline;
}

/**
 * Recalculates the state of a stream deterministically: the outcome, errors included, depends only
 * on the set of events, never on their arrival order. Returns no partial state.
 *
 * Accepts only the output of parseEventEnvelope, whose limits make it safe to compare: the type
 * alone does not prove that, and an event built by hand with a very deep payload can overflow the
 * stack here. An exception inside an applier becomes event-rejected.
 */
export function replayEvents<S>(
  config: ReplayConfig<S>,
  events: readonly EventEnvelope[],
): Result<ReplayedState<S>, ReplayError> {
  const timeline = replayTimeline(config, events);
  if (!timeline.ok) {
    return timeline;
  }
  const { entries } = timeline.value;
  const last = entries[entries.length - 1];
  return ok({
    state: last === undefined ? config.initialState : last.state,
    activeEventIds: entries.map(({ event }) => event.eventId),
  });
}
