import { useCourtSides } from "../../../features/court/hooks/court-sides-context";
import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { CourtPlaceholder } from "../../../features/court/ui/CourtPlaceholder";
import { strings } from "../../../strings/pt-BR";

/** Placeholder of screen 23 (E4.10). */
export default function MenuRoute() {
  const { back, leave } = useCourtRoute();
  const { inverted, toggle } = useCourtSides();
  const { menuPlaceholder } = strings.court;
  return (
    <CourtPlaceholder
      title={menuPlaceholder.title}
      lines={[]}
      actions={[
        {
          label: menuPlaceholder.flipSides,
          accessibilityLabel: menuPlaceholder.flipSidesLabel(inverted),
          variant: "secondary",
          onPress: toggle,
        },
        { label: menuPlaceholder.leave, onPress: leave },
        { label: menuPlaceholder.close, variant: "secondary", onPress: back },
      ]}
    />
  );
}
