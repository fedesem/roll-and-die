import { spawnSync } from "node:child_process";

const gitCheck = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
  stdio: "ignore"
});

if (gitCheck.status !== 0) {
  console.log("Skipping Lefthook install because this directory is not a Git worktree.");
  process.exit(0);
}

const lefthook = spawnSync("npx", ["lefthook", "install"], {
  stdio: "inherit"
});

process.exit(lefthook.status ?? 0);
