import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { RosterEntry } from "../model/roster";

const { confirmed, detail } = strings.rounds;

export interface ConfirmedSheetProps {
  readonly visible: boolean;
  /** The confirmed, with the names joined from the member list. */
  readonly going: readonly RosterEntry[];
  readonly waitlistLine: string;
  readonly meId: string;
  /** `null` for who does not manage rounds: no "Tirar" (question 47). */
  readonly onRemove: ((memberId: string) => void) | null;
  readonly removing: boolean;
  readonly onClose: () => void;
}

export interface ConfirmedRowProps {
  readonly entry: RosterEntry;
  readonly name: string;
  readonly onRemove: (() => void) | null;
  readonly removing: boolean;
}

function ConfirmedRow({ entry, name, onRemove, removing }: ConfirmedRowProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        minHeight: tokens.sizes.minTouchTarget,
      }}
    >
      <Text variant="muted">{confirmed.position(entry.position)}</Text>
      <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
        {name}
      </Text>
      {onRemove === null ? null : (
        <Button
          label={confirmed.remove}
          variant="dangerText"
          accessibilityLabel={confirmed.removeLabel(name)}
          disabled={removing}
          onPress={onRemove}
        />
      )}
    </View>
  );
}

/** The list of the confirmed, shared by screens 06 and 26 ("N confirmados", "Ver os 12"). */
export function ConfirmedSheet({
  visible,
  going,
  waitlistLine,
  meId,
  onRemove,
  removing,
  onClose,
}: ConfirmedSheetProps) {
  const ordered = [...going].sort((first, second) => first.position - second.position);
  return (
    <BottomSheet visible={visible} title={confirmed.sheetTitle(going.length)} onClose={onClose}>
      {ordered.length === 0 ? <Text variant="muted">{confirmed.nobody}</Text> : null}
      {ordered.map((entry) => (
        <ConfirmedRow
          key={entry.memberId}
          entry={entry}
          name={entry.memberId === meId ? confirmed.youRow : (entry.name ?? detail.noName)}
          removing={removing}
          onRemove={
            onRemove === null
              ? null
              : () => {
                  onRemove(entry.memberId);
                }
          }
        />
      ))}
      {waitlistLine === "" ? null : <Text variant="muted">{confirmed.waitlist(waitlistLine)}</Text>}
      <Button label={confirmed.close} variant="outline" onPress={onClose} />
    </BottomSheet>
  );
}
