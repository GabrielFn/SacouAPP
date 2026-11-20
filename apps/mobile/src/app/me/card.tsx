import { useRouter } from "expo-router";

import { strings } from "../../strings/pt-BR";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";

/** Screen 15 (share the card): the route is here; the screen arrives with part 2 of E4.13. */
export default function CardRoute() {
  const router = useRouter();
  return (
    <Screen>
      <EmptyState
        title={strings.profile.me.shareSoonTitle}
        actions={[
          {
            label: strings.a11y.back,
            variant: "secondary",
            onPress: () => {
              router.back();
            },
          },
        ]}
      />
    </Screen>
  );
}
