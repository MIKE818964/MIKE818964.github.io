// GENERATED - do not edit here. Source: C:\PythonProjects\eve_frontier_companion\mods\hb_refinery_dapp
// scripts/buildPilotDirectory.ts (+ src/bountyScene/directoryBuild.ts, pilotDirectory.ts), bundled with:
//   npx esbuild scripts/buildPilotDirectory.ts --bundle --platform=node --format=esm --target=node20 --outfile=build-pilots.mjs
// Read-only chain scan: no key, no wallet, nothing signed. It writes ../public/pilots.json next to its own folder,
// so the nightly workflow runs it from a scratch folder and copies the result in.
// scripts/buildPilotDirectory.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// src/bountyScene/pilotDirectory.ts
function asRecord(v) {
  return v && typeof v === "object" ? v : null;
}
function pilotFromCharacterNode(node) {
  const j = asRecord(node?.asMoveObject?.contents?.json);
  if (!j) return null;
  const key = asRecord(j.key);
  const meta = asRecord(j.metadata);
  const itemId = String(key?.item_id ?? "");
  const name = String(meta?.name ?? "").trim();
  if (!itemId || !name) return null;
  return { name, itemId, id: String(node.address ?? ""), address: String(j.character_address ?? "") };
}
function dedupePilotsByItemId(nodes) {
  const byItemId = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    const p = pilotFromCharacterNode(n);
    if (p && !byItemId.has(p.itemId)) byItemId.set(p.itemId, p);
  }
  return [...byItemId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// src/bountyScene/directoryBuild.ts
var DIRECTORY_DEFAULTS = {
  endpoint: "https://graphql.testnet.sui.io/graphql",
  world: "0x8b8a46ed766fa1358ce7c5c51f6a164b13d627a63e45343f69ed0ba0446c1aa1",
  tenant: "stillness"
};
var isObjectId = (s) => /^0x[0-9a-f]{64}$/i.test(s);
function resolveDirectoryConfig(env = {}) {
  const endpoint = env.VITE_SUI_GRAPHQL_ENDPOINT?.trim() || DIRECTORY_DEFAULTS.endpoint;
  const world = env.VITE_WORLD_ORIGINAL_ID?.trim() || DIRECTORY_DEFAULTS.world;
  const tenant = env.VITE_DEFAULT_TENANT?.trim() || DIRECTORY_DEFAULTS.tenant;
  if (!isObjectId(world)) throw new Error(`VITE_WORLD_ORIGINAL_ID must be a 0x + 64-hex object id (got "${world}")`);
  if (!tenant) throw new Error("VITE_DEFAULT_TENANT must not be blank");
  if (!/^https?:\/\//i.test(endpoint)) throw new Error(`VITE_SUI_GRAPHQL_ENDPOINT must be an http(s) URL (got "${endpoint}")`);
  return { endpoint, world, tenant, type: `${world}::character::Character` };
}
var CHARACTERS_QUERY = `query Chars($t: String!, $after: String) {
  objects(filter: { type: $t }, first: 50, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { address asMoveObject { contents { json } } }
  }
}`;
function asRecord2(v) {
  return v && typeof v === "object" ? v : null;
}
function parseCharacterPage(body) {
  const b = asRecord2(body);
  const errors = b && Array.isArray(b.errors) ? b.errors : null;
  if (errors?.length) throw new Error(`GraphQL: ${errors.map((e) => e?.message ?? "?").join("; ")}`);
  const objects = asRecord2(asRecord2(b?.data)?.objects);
  if (!objects) throw new Error("GraphQL: response had no objects");
  const pi = asRecord2(objects.pageInfo);
  if (!pi || !Array.isArray(objects.nodes)) throw new Error("GraphQL: objects missing pageInfo/nodes");
  const hasNextPage = Boolean(pi.hasNextPage);
  const endCursor = typeof pi.endCursor === "string" ? pi.endCursor : null;
  if (hasNextPage && !endCursor) throw new Error("GraphQL: hasNextPage is true but endCursor is missing/malformed");
  return { pageInfo: { hasNextPage, endCursor }, nodes: objects.nodes };
}

// scripts/buildPilotDirectory.ts
var OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "pilots.json");
var MAX_PAGES = 500;
var FETCH_TIMEOUT_MS = 2e4;
var MAX_ATTEMPTS = 6;
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchPage(endpoint, type, after) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query: CHARACTERS_QUERY, variables: { t: type, after } }),
        signal: ac.signal
      });
    } catch {
      await sleep(1500 * (attempt + 1));
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429) {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status} ${res.statusText}`);
    let body;
    try {
      body = await res.json();
    } catch {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    return parseCharacterPage(body);
  }
  throw new Error("rate-limited/failed too many times");
}
async function main() {
  const cfg = resolveDirectoryConfig(process.env);
  const nodes = [];
  let after = null;
  let pages = 0;
  let hitCap = false;
  const t0 = Date.now();
  for (; ; ) {
    const { pageInfo, nodes: pageNodes } = await fetchPage(cfg.endpoint, cfg.type, after);
    nodes.push(...pageNodes);
    pages++;
    if (pages % 20 === 0) console.error(`  ${pages} pages \xB7 ${nodes.length} nodes \xB7 ${((Date.now() - t0) / 1e3).toFixed(0)}s`);
    if (!pageInfo.hasNextPage) break;
    if (pages >= MAX_PAGES) {
      hitCap = true;
      break;
    }
    after = pageInfo.endCursor;
  }
  const pilots = dedupePilotsByItemId(nodes);
  try {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({
      updated: (/* @__PURE__ */ new Date()).toISOString(),
      world: cfg.world,
      tenant: cfg.tenant,
      count: pilots.length,
      complete: !hitCap,
      pilots
    }));
  } catch (e) {
    console.error(`FAILED to write ${OUT}: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
  console.error(`DONE: wrote ${pilots.length} pilots to public/pilots.json (${pages} pages, ${((Date.now() - t0) / 1e3).toFixed(0)}s, complete=${!hitCap})`);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
