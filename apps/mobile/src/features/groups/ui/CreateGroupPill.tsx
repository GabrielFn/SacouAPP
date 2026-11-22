import { strings } from "../../../strings/pt-BR";
import { PlusIcon } from "../../../ui/Icons";
import { PillButton } from "../../../ui/PillButton";

export interface CreateGroupPillProps {
  readonly onPress: () => void;
}

/** The dark "+ Criar grupo" pill of the groups list header (Grupos.dc.html). */
export function CreateGroupPill({ onPress }: CreateGroupPillProps) {
  return (
    <PillButton
      label={strings.groups.createGroup}
      onPress={onPress}
      renderIcon={(color) => <PlusIcon color={color} />}
    />
  );
}
