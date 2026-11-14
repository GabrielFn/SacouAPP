import { strings } from "../../../strings/pt-BR";
import { BackBar } from "../../../ui/BackBar";
import { groupsHref } from "../navigation";

/** Back and the title of screen 18. */
export function SettingsHeader() {
  return <BackBar title={strings.settings.screen.title} fallbackHref={groupsHref} look="heading" />;
}
