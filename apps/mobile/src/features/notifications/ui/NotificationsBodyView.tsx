import { View } from "react-native";

import { apiErrorText } from "../../../services/api/api-error-text";
import { notificationsStrings } from "../../../strings/notifications.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingState } from "../../../ui/LoadingState";
import { Text } from "../../../ui/Text";
import type { NotificationsBody } from "../model/notifications-view";
import { NotificationRow, type NotificationRowProps } from "./NotificationRow";

export interface NotificationsBodyViewProps {
  readonly body: NotificationsBody;
  readonly onRetry: () => void;
  readonly onOpen: NotificationRowProps["onOpen"];
}

/** The list of screen 28 by day, or the page of each other state of the query. */
export function NotificationsBodyView({ body, onRetry, onOpen }: NotificationsBodyViewProps) {
  const { colors, tokens } = useTheme();
  switch (body.kind) {
    case "loading":
      return <LoadingState accessibilityLabel={notificationsStrings.loading} />;
    case "offline-empty":
      return (
        <EmptyState
          title={notificationsStrings.offlineTitle}
          body={notificationsStrings.offlineBody}
        />
      );
    case "error":
      return (
        <EmptyState
          alert
          title={notificationsStrings.errorTitle}
          body={apiErrorText(body.error)}
          actions={[{ label: notificationsStrings.retry, variant: "secondary", onPress: onRetry }]}
        />
      );
    case "empty":
      return (
        <EmptyState title={notificationsStrings.emptyTitle} body={notificationsStrings.emptyBody} />
      );
    case "list":
      return (
        <View style={{ gap: tokens.spacing.s6 }}>
          {body.days.map((day) => (
            <View key={day.label} style={{ gap: tokens.spacing.s6 }}>
              <Text
                accessibilityRole="header"
                variant="bodyStrong"
                style={{ marginTop: tokens.spacing.s14, fontSize: tokens.fontSizes.small }}
              >
                {day.label}
              </Text>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: tokens.borderWidths.thin,
                  borderColor: colors.borderCard,
                  borderRadius: tokens.radii.tile,
                  overflow: "hidden",
                }}
              >
                {day.items.map((row, index) => (
                  <NotificationRow
                    key={row.item.id}
                    row={row}
                    first={index === 0}
                    onOpen={onOpen}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      );
  }
}
