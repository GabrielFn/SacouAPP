/**
 * The password from the tap to the request, outside any state (ADR 0057, D12): the mutation takes no
 * variables, so the password never sits in `mutation.state.variables` nor in the mutation cache. It is
 * taken once, at the start of the request, and forgotten right there.
 */
export interface PasswordHandoff {
  give(password: string | null): void;
  /** What was given, and from here on `null`. */
  take(): string | null;
}

export function createPasswordHandoff(): PasswordHandoff {
  const held: { value: string | null } = { value: null };
  return {
    give(password) {
      held.value = password;
    },
    take() {
      const password = held.value;
      held.value = null;
      return password;
    },
  };
}
