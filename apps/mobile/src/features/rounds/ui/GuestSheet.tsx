import { Pressable, View } from "react-native";

import { membersStrings } from "../../../strings/members.pt-BR";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { LevelSheet } from "../../../ui/LevelSheet";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import type { AddPlayerModel } from "../hooks/use-add-player";
import { GUEST_POSITIONS, type GuestSheet as GuestSheetState } from "../model/add-player.reducer";
import { initialOf } from "../model/confirmed-summary";
import { guestLevelText, normalizeGuestName } from "../model/guest-form";

const { guest } = strings.rounds;
const { positions } = strings.ratings;

type OpenSheet = Extract<GuestSheetState, { readonly kind: "open" }>;

export interface GuestBlockProps {
  readonly model: AddPlayerModel;
}

/** "Convidado sem conta" at the end of screen 21: the name, "Entra como · Avulso" and the button to 21a. */
export function GuestBlock({ model }: GuestBlockProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        gap: tokens.spacing.s10,
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.card,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="bodyStrong" accessibilityRole="header">
        {guest.blockTitle}
      </Text>
      <TextField
        label={guest.name}
        value={model.state.guestName}
        autoCapitalize="words"
        onChangeText={(name) => {
          model.dispatch({ type: "guest-name-changed", name });
        }}
      />
      <Text variant="muted">{`${guest.joinsAs} · ${membersStrings.row.dropIn}`}</Text>
      <Button label={guest.open} variant="secondary" onPress={model.openGuest} />
    </View>
  );
}

export interface PositionChipsProps {
  readonly sheet: OpenSheet;
  readonly model: AddPlayerModel;
}

/** "Posição · opcional": a radio group of five; touching the chosen one again leaves it empty. */
function PositionChips({ sheet, model }: PositionChipsProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <Text variant="bodyStrong">
        {`${guest.position} `}
        <Text variant="muted">{guest.optional}</Text>
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={guest.position}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}
      >
        {GUEST_POSITIONS.map((position) => (
          <Chip
            key={position}
            label={positions[position]}
            selected={sheet.position === position}
            onPress={() => {
              model.dispatch({ type: "guest-position-toggled", position });
            }}
          />
        ))}
      </View>
    </View>
  );
}

export interface LevelRowProps {
  readonly sheet: OpenSheet;
  readonly model: AddPlayerModel;
}

/** "Nota do sorteio · 3,0 · definir": opens the level step in place of the sheet. */
function LevelRow({ sheet, model }: LevelRowProps) {
  const { colors, tokens } = useTheme();
  const text = guestLevelText(sheet.level);
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={guest.levelLabel(text)}
        onPress={() => {
          model.dispatch({ type: "guest-level-opened" });
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: tokens.sizes.minTouchTarget,
          gap: tokens.spacing.s,
        }}
      >
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {guest.level}
        </Text>
        <Text variant="bodyStrong" style={{ color: colors.link }}>
          {text}
        </Text>
      </Pressable>
      <Text variant="caption">{guest.privacy}</Text>
    </View>
  );
}

export interface GuestFormSheetProps {
  readonly sheet: OpenSheet;
  readonly model: AddPlayerModel;
}

function GuestFormSheet({ sheet, model }: GuestFormSheetProps) {
  const { tokens } = useTheme();
  const typed = model.state.guestName.trim() !== "";
  return (
    <BottomSheet visible title={guest.title} onClose={model.closeGuest}>
      <View style={{ gap: tokens.spacing.m }}>
        <Text variant="muted">{guest.intro}</Text>
        <TextField
          label={guest.nameLabel}
          value={model.state.guestName}
          autoCapitalize="words"
          error={typed ? (model.guestNameError ?? undefined) : undefined}
          onChangeText={(name) => {
            model.dispatch({ type: "guest-name-changed", name });
          }}
        />
        <PositionChips sheet={sheet} model={model} />
        <LevelRow sheet={sheet} model={model} />
        {model.guestErrorText === null ? null : <ErrorStrip text={model.guestErrorText} />}
        <Button
          label={model.addingGuest ? guest.submitting : guest.submit}
          disabled={model.guestNameError !== null || model.addingGuest}
          onPress={model.addGuest}
        />
      </View>
    </BottomSheet>
  );
}

export interface GuestSheetProps {
  readonly model: AddPlayerModel;
}

/**
 * The sheet 21a over screen 21, and the level step 19a in its place (one `Modal` at a time). The draft of
 * the level lives only in the reducer while the sheet is open; it never goes to the cache (ADR 0047).
 */
export function GuestSheet({ model }: GuestSheetProps) {
  const sheet = model.state.guestSheet;
  if (sheet.kind === "closed") return null;
  if (sheet.step === "form") return <GuestFormSheet sheet={sheet} model={model} />;
  const name = normalizeGuestName(model.state.guestName);
  const shownName = name === "" ? guest.title : name;
  const position = sheet.position === null ? null : positions[sheet.position];
  return (
    <LevelSheet
      visible
      name={shownName}
      detail={
        position === null
          ? membersStrings.row.noAccount
          : `${membersStrings.row.noAccount} · ${position}`
      }
      initials={name === "" ? null : initialOf(name)}
      dashedAvatar
      suggestion={null}
      value={sheet.levelDraft}
      pending={false}
      errorText={null}
      onChange={(tenths) => {
        model.dispatch({ type: "guest-level-drafted", tenths });
      }}
      onSave={(tenths) => {
        model.dispatch({ type: "guest-level-set", tenths });
      }}
      onClose={() => {
        model.dispatch({ type: "guest-level-closed" });
      }}
    />
  );
}
