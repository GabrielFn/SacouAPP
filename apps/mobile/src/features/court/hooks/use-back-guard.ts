import { useEffect } from "react";

import { useServices } from "../../../services/services-context";

/** Blocks the back button of the phone while `active`. */
export function useBackGuard(active: boolean): void {
  const { backGuard } = useServices();
  useEffect(() => (active ? backGuard.block() : undefined), [active, backGuard]);
}
