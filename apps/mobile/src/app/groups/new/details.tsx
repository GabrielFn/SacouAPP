import { SETTINGS_TEMPLATE_KEYS, type SettingsTemplateKey } from "@sacou/match-engine";
import { Redirect, useLocalSearchParams } from "expo-router";

import { createGroupHref, TEMPLATE_PARAM } from "../../../features/groups/navigation";
import { CreateGroupDetailsScreen } from "../../../features/groups/ui/CreateGroupDetailsScreen";

function isTemplateKey(value: unknown): value is SettingsTemplateKey {
  return SETTINGS_TEMPLATE_KEYS.some((key) => key === value);
}

/** Screen 05: the template comes on the route; a missing or unknown one goes back to screen 04. */
export default function CreateGroupDetailsRoute() {
  const params = useLocalSearchParams<{ [TEMPLATE_PARAM]?: string }>();
  const template = params[TEMPLATE_PARAM];
  if (!isTemplateKey(template)) return <Redirect href={createGroupHref} />;
  return <CreateGroupDetailsScreen templateKey={template} />;
}
