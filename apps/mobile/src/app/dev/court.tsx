import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { DEV_TOOLS_ENABLED } from "../../config/dev-tools";
import { useCourtRuntime } from "../../features/court/hooks/court-runtime-context";
import {
  startSampleMatch,
  type SampleMatchKind,
} from "../../features/court/dev/start-sample-match";
import { courtHref } from "../../features/court/navigation";
import { strings } from "../../strings/pt-BR";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

/** Opens the sample matches of the design screens; the pre-game will replace it as the way in (E4.7). */
export default function DevCourtScreen() {
  const runtime = useCourtRuntime();
  const router = useRouter();
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Counts the changes made here, so the lookup of the open session runs again after each one.
  const [changes, setChanges] = useState(0);

  useEffect(() => {
    const alive = { current: true };
    void runtime.log.findActiveSession().then((active) => {
      if (alive.current) {
        setOpenSession(active.ok ? active.value : null);
      }
    });
    return () => {
      alive.current = false;
    };
  }, [runtime, changes]);

  const open = (courtSessionId: string) => {
    router.push(courtHref("court", { courtSessionId }));
  };
  const start = async (kind: SampleMatchKind) => {
    const started = await startSampleMatch(runtime, kind);
    if (started.ok) {
      setMessage(null);
      open(started.value.courtSessionId);
    } else {
      setMessage(strings.court.dev.startFailed);
    }
    setChanges((count) => count + 1);
  };
  const closeCourt = async () => {
    if (openSession !== null) {
      await runtime.log.closeSession(openSession);
    }
    setChanges((count) => count + 1);
  };

  if (!DEV_TOOLS_ENABLED) return <Redirect href="/" />;
  const { dev } = strings.court;
  return (
    <Screen>
      <Text variant="title">{dev.title}</Text>
      <Button
        label={dev.newOneSet}
        onPress={() => {
          void start("one-set");
        }}
      />
      <Button
        label={dev.newBestOfThree}
        onPress={() => {
          void start("best-of-three");
        }}
      />
      <Button
        label={dev.newWithLibero}
        onPress={() => {
          void start("with-libero");
        }}
      />
      <Button
        label={dev.newLongNames}
        onPress={() => {
          void start("long-names");
        }}
      />
      {openSession === null ? null : (
        <>
          <Button
            label={dev.resume}
            variant="secondary"
            onPress={() => {
              open(openSession);
            }}
          />
          <Button
            label={dev.closeCourt}
            variant="link"
            onPress={() => {
              void closeCourt();
            }}
          />
        </>
      )}
      {message === null ? null : <Text variant="muted">{message}</Text>}
    </Screen>
  );
}
