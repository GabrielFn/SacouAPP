import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

interface MetroConfig {
  readonly resolver: { readonly blockList: readonly RegExp[] };
  readonly watchFolders?: readonly string[];
}

const load = createRequire(import.meta.url);
const config = load("../../metro.config.js") as MetroConfig;

function blocked(path: string): boolean {
  return config.resolver.blockList.some((pattern) => pattern.test(path));
}

describe("the Metro of the app (R98, item 7)", () => {
  test("keeps the agent worktrees out, with either separator", () => {
    expect(blocked("D:\\projetos\\SacouAPP\\.claude\\worktrees\\agent-1\\node_modules\\x.js")).toBe(
      true,
    );
    expect(blocked("/repo/.claude/worktrees/agent-1/apps/mobile/src/app/index.tsx")).toBe(true);
  });

  test("still sees the app, the packages and the rest of .claude", () => {
    expect(blocked("/repo/apps/mobile/src/app/index.tsx")).toBe(false);
    expect(blocked("/repo/packages/match-engine/dist/index.js")).toBe(false);
    expect(blocked("/repo/.claude/skills/bateria/SKILL.md")).toBe(false);
  });
});
