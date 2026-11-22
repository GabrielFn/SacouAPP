// Metro of the app (R98, item 7). Expo watches the whole monorepo, so the agent worktrees under
// .claude/worktrees/, each with its own node_modules, are kept out: they flooded the watcher and
// could put a second copy of a module in the bundle.
const { getDefaultConfig } = require("expo/metro-config");

/** Any path inside `.claude/worktrees/`, with either separator. */
const WORKTREES = /[\/]\.claude[\/]worktrees[\/].*/;

/** The default block list (a pattern, a list or none) with the worktrees added. */
function withWorktreesBlocked(blockList) {
  if (blockList === undefined || blockList === null) return [WORKTREES];
  return [...(Array.isArray(blockList) ? blockList : [blockList]), WORKTREES];
}

const config = getDefaultConfig(__dirname);

module.exports = {
  ...config,
  resolver: { ...config.resolver, blockList: withWorktreesBlocked(config.resolver.blockList) },
};
