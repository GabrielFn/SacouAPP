import { Redirect, useLocalSearchParams } from "expo-router";

import { BLOCKS_PARAM, createGroupHref, TEMPLATE_PARAM } from "../../../features/groups/navigation";
import { originFromParams } from "../../../features/groups/model/custom-blocks";
import { CreateGroupDetailsScreen } from "../../../features/groups/ui/CreateGroupDetailsScreen";

/** Screen 05: the origin comes on the route; one that cannot be read goes back to screen 04. */
export default function CreateGroupDetailsRoute() {
  const params = useLocalSearchParams<{ [TEMPLATE_PARAM]?: string; [BLOCKS_PARAM]?: string }>();
  const origin = originFromParams(params[TEMPLATE_PARAM], params[BLOCKS_PARAM]);
  if (origin === null) return <Redirect href={createGroupHref} />;
  return <CreateGroupDetailsScreen origin={origin} />;
}
