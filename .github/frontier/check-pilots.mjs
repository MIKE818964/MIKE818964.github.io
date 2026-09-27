// Safety gate for the nightly pilot-directory refresh (.github/workflows/frontier-pilots-nightly.yml).
// A bad scan must never replace a good directory: an empty or half list would break the Bounty Board's name search
// for every player until someone noticed. So the new file is REFUSED (job fails, old file kept, GitHub emails the repo
// owner) when:
//   - the scan stopped at its page cap (complete !== true), or its count and list disagree
//   - it holds under 1,000 pilots (Stillness had 19,342 on 2026-09-27)
//   - the pilot count fell more than 10% since the last good file
//   - it is for a DIFFERENT world than the last file (EVE moving worlds needs a human decision, not a silent swap)
// Usage: node check-pilots.mjs <new pilots.json> <current pilots.json>
// Prints the verdict and writes changed=true|false to $GITHUB_OUTPUT (false = same pilots, nothing to commit).
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const refuse = (why) => { console.error(`REFUSED: ${why} - keeping the current directory.`); process.exit(1); };
if (process.argv.length < 4) refuse("missing arguments - usage: node check-pilots.mjs <new pilots.json> <current pilots.json>");
const [freshPath, currentPath] = process.argv.slice(2);

/** Read + parse a pilots.json; an unreadable or garbled file is a refusal, never a crash (Gemini gate review). */
function readList(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return refuse(`could not read the ${label} list (${path}): ${e instanceof Error ? e.message : e}`);
  }
}

const fresh = readList(freshPath, "new");
if (fresh.complete !== true) refuse("the scan did not finish (complete is not true)");
if (!Array.isArray(fresh.pilots) || fresh.count !== fresh.pilots.length) refuse("count does not match the pilot list");
if (fresh.count < 1000) refuse(`only ${fresh.count} pilots - looks like a failed scan`);

let changed = true;
if (existsSync(currentPath)) {
  const current = readList(currentPath, "current");
  if (current.world && current.world !== fresh.world) refuse(`world changed ${current.world} -> ${fresh.world}`);
  if (fresh.count < current.count * 0.9) refuse(`pilot count fell ${current.count} -> ${fresh.count} (over 10%)`);
  changed = JSON.stringify(current.pilots) !== JSON.stringify(fresh.pilots);
}

console.log(`OK: ${fresh.count} pilots, changed=${changed}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
