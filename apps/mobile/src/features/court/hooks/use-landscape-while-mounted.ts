import { useEffect } from "react";

import { useServices } from "../../../services/services-context";
import { lockLandscapeUntilReleased } from "../session/orientation-lock";

/**
 * The court turns the phone on its side while it is open. It is called by the layout that holds
 * every route of the court, so going to the menu and back does not turn the phone, and leaving the
 * court puts it upright again.
 */
export function useLandscapeWhileMounted(): void {
  const { screenOrientation } = useServices();
  useEffect(() => lockLandscapeUntilReleased(screenOrientation), [screenOrientation]);
}
