import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { CourtPlaceholder } from "../../../features/court/ui/CourtPlaceholder";
import { strings } from "../../../strings/pt-BR";

/** Placeholder of screen 24 (E4.10). */
export default function CorrectionsRoute() {
  const { back } = useCourtRoute();
  const { correctionsPlaceholder } = strings.court;
  return (
    <CourtPlaceholder
      title={correctionsPlaceholder.title}
      lines={[correctionsPlaceholder.soon]}
      actions={[{ label: correctionsPlaceholder.back, onPress: back }]}
    />
  );
}
