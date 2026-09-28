// Safety gate for the nightly pilot-directory refresh (.github/workflows/frontier-pilots-nightly.yml).
// A bad scan must never replace a good directory: an empty or half list would break the Bounty Board's name search
// for every player until someone noticed. So the new file is REFUSED (job fails, old file kept, GitHub emails the repo
// owner) when:
//   - the scan stopped at its page cap (complete !== true), or its count and list disagree
//   - it holds fewer pilots than the minimum (world.json minPilots; 1,000 without it - Stillness had 19,342 on 2026-09-27)
//   - the pilot count fell more than 10% since the last good file FROM THE SAME WORLD
//   - it is for a DIFFERENT world than the last file, unless world.json names that new world
//   - world.json names a world and the scan is not from it (a stale setting scanned the wrong world)
// EVE moving worlds is a human decision, not a silent swap: Stillness moved to a fresh world at Cycle 7 (2026-09-29).
// The switch is made by committing .github/frontier/world.json = {"world": "<new world original-id>", "minPilots": 1}
// (a fresh world starts with zero pilots); raise minPilots again once the new world has filled up.
// Usage: node check-pilots.mjs <new pilots.json> <current pilots.json> [world.json]
// Prints the verdict and writes changed=true|false to $GITHUB_OUTPUT (false = same pilots, nothing to commit).
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const refuse = (why) => { console.error(`REFUSED: ${why} - keeping the current directory.`); process.exit(1); };
if (process.argv.length < 4) refuse("missing arguments - usage: node check-pilots.mjs <new pilots.json> <current pilots.json> [world.json]");
const [freshPath, currentPath, worldPath] = process.argv.slice(2);

/** Read + parse a JSON file; an unreadable or garbled file is a refusal, never a crash (Gemini gate review). */
function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return refuse(`could not read the ${label} (${path}): ${e instanceof Error ? e.message : e}`);
  }
}

/** A Sui object id in one comparable form: lower case, no 0x, no leading zeros. "" for anything that isn't one. */
function normId(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase().replace(/^0x/, "") : "";
  return /^[0-9a-f]{1,64}$/.test(s) ? s.replace(/^0+/, "") || "0" : "";
}

// The site's decision about which world the directory must come from (optional, for older callers).
let named = null;
let minPilots = 1000;
if (worldPath) {
  const w = readJson(worldPath, "world setting");
  const id = w && typeof w === "object" ? w.world : undefined;
  if (typeof id !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(id.trim())) {
    refuse(`world.json must name the world as a full 0x + 64-hex id (got ${JSON.stringify(id)})`);
  }
  if (!Number.isInteger(w.minPilots) || w.minPilots < 1) {
    refuse(`world.json minPilots must be a whole number of at least 1 (got ${JSON.stringify(w.minPilots)})`);
  }
  named = normId(id);
  minPilots = w.minPilots;
}

const fresh = readJson(freshPath, "new list");
if (fresh.complete !== true) refuse("the scan did not finish (complete is not true)");
if (!Array.isArray(fresh.pilots) || fresh.count !== fresh.pilots.length) refuse("count does not match the pilot list");
if (named && normId(fresh.world) !== named) refuse(`the scan is from world ${fresh.world}, not the world named in world.json`);
if (fresh.count < minPilots) refuse(`only ${fresh.count} pilots (minimum ${minPilots}) - looks like a failed scan`);

let changed = true;
if (existsSync(currentPath)) {
  const current = readJson(currentPath, "current list");
  const sameWorld = !current.world || normId(current.world) === normId(fresh.world);
  if (!sameWorld) {
    if (!named) refuse(`world changed ${current.world} -> ${fresh.world}`);
    console.log(`World switch accepted (named in world.json): ${current.world} -> ${fresh.world}`);
  } else {
    if (fresh.count < current.count * 0.9) refuse(`pilot count fell ${current.count} -> ${fresh.count} (over 10%)`);
    changed = JSON.stringify(current.pilots) !== JSON.stringify(fresh.pilots);
  }
}

console.log(`OK: ${fresh.count} pilots, changed=${changed}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
