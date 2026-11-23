import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, test } from "vitest";

interface MetroConfig {
  readonly resolver: { readonly blockList: readonly RegExp[] };
  readonly worktreesPattern: (appRoot: string) => RegExp;
}

const load = createRequire(import.meta.url);
const config = load("../../metro.config.js") as MetroConfig;
const appRoot = path.resolve(import.meta.dirname, "../..");
const repoRoot = path.resolve(appRoot, "../..");

function blocked(file: string): boolean {
  return config.resolver.blockList.some((pattern) => pattern.test(file));
}

/** The same path with both separators, as Metro can see either. */
function bothSeparators(file: string): readonly string[] {
  return [file.replaceAll("\\", "/"), file.replaceAll("/", "\\")];
}

describe("the Metro of the app (R98, item 7)", () => {
  test.each(bothSeparators(path.join(repoRoot, ".claude/worktrees/agent-1/node_modules/x.js")))(
    "keeps the agent worktrees out: %s",
    (file) => {
      expect(blocked(file)).toBe(true);
    },
  );

  test("still sees the app, the packages and the rest of .claude", () => {
    expect(blocked(path.join(appRoot, "src/app/index.tsx"))).toBe(false);
    expect(blocked(path.join(repoRoot, "packages/match-engine/dist/index.js"))).toBe(false);
    expect(blocked(path.join(repoRoot, ".claude/skills/bateria/SKILL.md"))).toBe(false);
  });
});

describe("the worktree pattern is anchored on the repository (R98 Part 3b)", () => {
  const root = path.resolve("/repo/.claude/worktrees/agent-1/apps/mobile");

  test("an app that itself lives inside a worktree is not blocked", () => {
    const pattern = config.worktreesPattern(root);
    expect(pattern.test(path.join(root, "src/app/index.tsx"))).toBe(false);
    expect(
      pattern.test(path.resolve("/repo/.claude/worktrees/agent-1/.claude/worktrees/agent-2/x.js")),
    ).toBe(true);
  });

  test("a look-alike folder outside this repository, or a longer name, is not blocked", () => {
    const pattern = config.worktreesPattern(path.resolve("/repo/apps/mobile"));
    expect(pattern.test(path.resolve("/other/.claude/worktrees/a/x.js"))).toBe(false);
    expect(pattern.test(path.resolve("/repo/.claude/worktrees/a/x.js"))).toBe(true);
    expect(pattern.test(path.resolve("/repo/.claude/worktreesX/a/x.js"))).toBe(false);
  });
});
