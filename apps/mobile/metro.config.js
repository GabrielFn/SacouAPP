// Metro of the app (R98, item 7). Expo watches the whole monorepo, so the agent worktrees under
// .claude/worktrees/, each with its own node_modules, are kept out: they flooded the watcher and
// could put a second copy of a module in the bundle.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Any path inside the `.claude/worktrees/` of this repository (two folders above the app), with either
 * separator. Anchored on the repository, so an app that itself lives inside a worktree is not blocked.
 */
function worktreesPattern(appRoot) {
  const folder = escapeRegExp(path.resolve(appRoot, "../../.claude/worktrees")).replace(
    /\\\\|\//g,
    "[\\\\/]",
  );
  return new RegExp(`^${folder}[\\\\/].*`);
}

/** The default block list (a pattern, a list or none) with the worktrees added. */
function withWorktreesBlocked(blockList, appRoot) {
  const worktrees = worktreesPattern(appRoot);
  if (blockList === undefined || blockList === null) return [worktrees];
  return [...(Array.isArray(blockList) ? blockList : [blockList]), worktrees];
}

const config = getDefaultConfig(__dirname);

module.exports = {
  ...config,
  worktreesPattern,
  resolver: {
    ...config.resolver,
    blockList: withWorktreesBlocked(config.resolver.blockList, __dirname),
  },
};
