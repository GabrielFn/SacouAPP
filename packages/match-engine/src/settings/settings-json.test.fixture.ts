// Edits of raw JSON for the settings tests, without mutating the input.

/** Marks a key to drop instead of a value to write. */
export const REMOVED = Symbol("removed");

type Json = unknown;

function editedChild(container: Json, key: string, child: (value: Json) => Json): Json {
  if (Array.isArray(container)) {
    return container.map((item: Json, index) => (String(index) === key ? child(item) : item));
  }
  const record = container as Readonly<Record<string, Json>>;
  const value = child(record[key]);
  const others = Object.entries(record).filter(([name]) => name !== key || value !== REMOVED);
  const entries =
    Object.hasOwn(record, key) || value === REMOVED ? others : [...others, [key, value]];
  return Object.fromEntries(entries.map(([name, item]) => [name, name === key ? value : item]));
}

/** A copy of `json` with the value at `keys` replaced, or dropped with `REMOVED`. */
export function editJson(json: Json, keys: readonly string[], value: Json): Json {
  const [first, ...rest] = keys;
  if (first === undefined) {
    return value;
  }
  return editedChild(json, first, (child) =>
    rest.length === 0 ? value : editJson(child, rest, value),
  );
}
