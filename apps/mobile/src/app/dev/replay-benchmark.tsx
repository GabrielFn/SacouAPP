import { Redirect } from "expo-router";
import { useReducer } from "react";
import { ScrollView } from "react-native";

import { DEV_TOOLS_ENABLED } from "../../config/dev-tools";
import { formatReport } from "../../features/court/dev/benchmark-report";
import {
  benchmarkScreenReducer,
  INITIAL_BENCHMARK_SCREEN,
  resultsOf,
} from "../../features/court/dev/benchmark-screen.reducer";
import { runBenchmark } from "../../features/court/dev/run-benchmark";
import { strings } from "../../strings/pt-BR";
import { useServices } from "../../services/services-context";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

const NEXT_FRAME_MS = 0;

function pause(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, NEXT_FRAME_MS);
  });
}

/** Facts that say whether the numbers mean anything: production mode, Hermes and `Object.groupBy`. */
function environmentLine(): string {
  return strings.court.benchmark.mode(
    !__DEV__,
    "HermesInternal" in globalThis,
    typeof (Object as { groupBy?: unknown }).groupBy === "function",
  );
}

/** Measures the replay on the phone's own engine (E4.9). Only in builds with the dev tools on. */
export default function ReplayBenchmarkScreen() {
  const { benchmarkRuntimeOpener, clock, courtRoster } = useServices();
  const [state, dispatch] = useReducer(benchmarkScreenReducer, INITIAL_BENCHMARK_SCREEN);

  const run = async () => {
    if (state.status === "running") {
      return;
    }
    dispatch({ type: "start" });
    try {
      const opened = await benchmarkRuntimeOpener.open();
      if (!opened.ok) {
        dispatch({ type: "fail" });
        return;
      }
      const runtime = opened.value;
      await runBenchmark(
        { clock, roster: courtRoster, runtime, pause },
        runtime.ids,
        ({ scenario }) => {
          dispatch({ type: "scenario-started", scenario });
        },
        (result) => {
          dispatch({ type: "scenario-finished", result });
        },
      );
      dispatch({ type: "finish" });
    } catch {
      dispatch({ type: "fail" });
    }
  };

  if (!DEV_TOOLS_ENABLED) return <Redirect href="/" />;
  const { benchmark } = strings.court;
  const results = resultsOf(state);
  return (
    <Screen>
      <ScrollView>
        <Text variant="title">{benchmark.title}</Text>
        <Text variant="muted">{benchmark.intro}</Text>
        <Button
          label={benchmark.run}
          onPress={() => {
            void run();
          }}
        />
        {state.status === "running" ? <Text>{benchmark.running(state.scenario)}</Text> : null}
        {state.status === "done" ? <Text>{benchmark.done}</Text> : null}
        {state.status === "failed" ? <Text>{benchmark.failed}</Text> : null}
        {results.length === 0 ? null : (
          <Text selectable>{`${environmentLine()}

${formatReport(results)}`}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}
