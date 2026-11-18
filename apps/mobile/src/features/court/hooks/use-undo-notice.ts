import { useCallback, useEffect, useState } from "react";

import { UNDO_NOTICE_MS } from "../court.data";

export interface UndoNoticeControl {
  /** The line "Desfeito: ..." while it is on, or `null`. */
  readonly text: string | null;
  readonly show: (text: string) => void;
}

/** The line that says what DESFAZER took back: it lasts `UNDO_NOTICE_MS` and a new one replaces it. */
export function useUndoNotice(): UndoNoticeControl {
  // The tick tells two equal lines apart, so the second one restarts the time.
  const [shown, setShown] = useState<{ readonly text: string; readonly tick: number } | null>(null);
  useEffect(() => {
    if (shown === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setShown(null);
    }, UNDO_NOTICE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [shown]);
  const show = useCallback((text: string) => {
    setShown((current) => ({ text, tick: (current?.tick ?? 0) + 1 }));
  }, []);
  return { text: shown?.text ?? null, show };
}
