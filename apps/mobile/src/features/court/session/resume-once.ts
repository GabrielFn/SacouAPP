/** The court to go back to when the app opens: decided once, and handed over once. */
export interface ResumeOnce {
  /** The session to resume the first time it is asked, `null` every time after. */
  readonly take: () => string | null;
}

export function createResumeOnce(courtSessionId: string | null): ResumeOnce {
  const pending = { value: courtSessionId };
  return {
    take() {
      const taken = pending.value;
      pending.value = null;
      return taken;
    },
  };
}
