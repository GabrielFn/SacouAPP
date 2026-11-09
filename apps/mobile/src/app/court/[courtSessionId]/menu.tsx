import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { CourtPlaceholder } from "../../../features/court/ui/CourtPlaceholder";
import { strings } from "../../../strings/pt-BR";

/** Placeholder of screen 23 (E4.10). */
export default function MenuRoute() {
  const { back, leave } = useCourtRoute();
  const { menuPlaceholder } = strings.court;
  return (
    <CourtPlaceholder
      title={menuPlaceholder.title}
      lines={[]}
      actions={[
        { label: menuPlaceholder.leave, onPress: leave },
        { label: menuPlaceholder.close, variant: "secondary", onPress: back },
      ]}
    />
  );
}
