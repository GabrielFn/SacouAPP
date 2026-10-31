export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  (Object.values(value) as readonly unknown[]).forEach((child) => {
    deepFreeze(child);
  });
  return Object.freeze(value);
}
