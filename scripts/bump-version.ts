#!/usr/bin/env bun
export {};

const version = process.argv[2];

if (!version) {
  console.error("Usage: bun scripts/bump-version.ts <version>");
  console.error("Example: bun scripts/bump-version.ts 1.1.0");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version format: "${version}". Expected x.y.z`);
  process.exit(1);
}

const root = import.meta.dir + "/..";

function run(args: string[]) {
  const result = Bun.spawnSync(args, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
}

function capture(args: string[]): string {
  const result = Bun.spawnSync(args, { cwd: root, stdout: "pipe", stderr: "pipe" });
  return result.stdout.toString().trim();
}

// Verify we're on a clean develop branch
const currentBranch = capture(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
if (currentBranch !== "develop") {
  console.error(`Must be on 'develop' branch (currently on '${currentBranch}')`);
  process.exit(1);
}

const gitStatus = capture(["git", "status", "--porcelain"]);
if (gitStatus !== "") {
  console.error("Working tree is not clean. Commit or stash your changes first.");
  process.exit(1);
}

// package.json
const pkgPath = root + "/package.json";
const pkg = await Bun.file(pkgPath).json();
pkg.version = version;
await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`✓ package.json → ${version}`);

// src-tauri/tauri.conf.json
const tauriConfPath = root + "/src-tauri/tauri.conf.json";
const tauriConf = await Bun.file(tauriConfPath).json();
tauriConf.version = version;
await Bun.write(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`✓ src-tauri/tauri.conf.json → ${version}`);

// src-tauri/Cargo.toml — replace first `version = "..."` line in [package]
const cargoPath = root + "/src-tauri/Cargo.toml";
const cargo = await Bun.file(cargoPath).text();
const updatedCargo = cargo.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${version}$2`);
await Bun.write(cargoPath, updatedCargo);
console.log(`✓ src-tauri/Cargo.toml → ${version}`);

// Commit and push develop
console.log("\nCommitting...");
run([
  "git",
  "add",
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
]);
run(["git", "commit", "-m", `"Bump version to ${version}"`]);

console.log("\nPushing develop...");
run(["git", "push", "origin", "develop"]);
run(["git", "push", "upstream", "develop"]);

// Merge develop into main
console.log("\nSwitching to main...");
run(["git", "checkout", "main"]);
run(["git", "pull", "--ff-only", "origin", "main"]);
run(["git", "merge", "--ff-only", "origin/develop"]);

console.log("\nPushing main...");
run(["git", "push", "origin", "main"]);
run(["git", "push", "upstream", "main"]);

// Tag and push to upstream
const tag = `v${version}`;
console.log(`\nTagging ${tag}...`);
run(["git", "tag", tag]);
run(["git", "push", "upstream", tag]);

console.log(`\nDone! Version ${version} released.`);
