import { useEffect, type ReactNode } from "react";

import { useServices } from "../../../services/services-context";
import { useAppConfig } from "../hooks/use-app-config";
import { isBelowMinimum, updateUrlOf } from "../model/app-config";
import { UpdateRequiredScreen } from "./UpdateRequiredScreen";

export interface AppVersionGateProps {
  readonly children: ReactNode;
}

/**
 * Blocks the app with "Atualize o Sacou" only on a known answer: from the network or from the persisted
 * cache. Loading, offline without a cache or a failed read show the app, so the court is never closed
 * by a doubt (ADR 0084). Derived on each render from the one record in the query cache.
 */
export function AppVersionGate({ children }: AppVersionGateProps) {
  const { appBuild, externalLink, backGuard } = useServices();
  const config = useAppConfig();
  const blocked = isBelowMinimum(appBuild, config);
  // The Android back button must not leave the update screen for a screen that would not work.
  useEffect(() => (blocked ? backGuard.block() : undefined), [blocked, backGuard]);
  if (!blocked) return <>{children}</>;
  return (
    <UpdateRequiredScreen
      updateUrl={updateUrlOf(appBuild, config)}
      onUpdate={(url) => void externalLink.open(url)}
    />
  );
}
