#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

note() {
  printf "[smoke] %s\n" "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    note "missing $1 (install to continue)"
    return 1
  fi
}

QDRANT_URL="${QDRANT_URL:-https://qdrant.rhei.team}"
CONVEX_URL="${CONVEX_URL:-https://convex.rhei.team}"

note "Qdrant URL: $QDRANT_URL"
note "Convex URL: $CONVEX_URL"

if require_cmd curl; then
  if [ -n "${QDRANT_API_KEY:-}" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -H "api-key: $QDRANT_API_KEY" \
      "$QDRANT_URL/collections/saga_unified" || true)
    note "qdrant saga_unified status: $status"
  else
    note "skip qdrant check (set QDRANT_API_KEY to enable)"
  fi

  health_status=$(curl -s -o /dev/null -w "%{http_code}" "$CONVEX_URL/health" || true)
  note "convex /health status: $health_status"
fi

if [ -z "${CONVEX_AUTH_TOKEN:-}" ]; then
  note "skip Convex tests (set CONVEX_AUTH_TOKEN to enable)"
  exit 0
fi

if ! require_cmd bun; then
  exit 1
fi

note "running Convex smoke steps"

tmp_script="$(mktemp)"
cat >"$tmp_script" <<'BUN'
const convexUrl = process.env.CONVEX_URL ?? "https://convex.rhei.team";
const token = process.env.CONVEX_AUTH_TOKEN;
if (!token) {
  console.log("[convex] missing CONVEX_AUTH_TOKEN");
  process.exit(1);
}

const { ConvexHttpClient } = await import("convex/browser");
const { anyApi } = await import("convex/server");

const client = new ConvexHttpClient(convexUrl);
client.setAuth(token);

let projectId = process.env.PROJECT_ID;
let createdProject = false;

if (!projectId) {
  const name = `Smoke Test ${new Date().toISOString()}`;
  projectId = await client.mutation(anyApi.projects.create, {
    name,
    description: "MLP1 smoke test",
  });
  createdProject = true;
}

console.log(`[convex] projectId=${projectId}`);

if (process.env.CREATE_MEMORY === "1") {
  const memoryId = await client.mutation(anyApi.memories.create, {
    projectId,
    text: "smoke test memory",
    type: "note",
    confidence: 0.5,
    source: "user",
  });
  const results = await client.query(anyApi.memories.search, {
    projectId,
    searchQuery: "smoke",
    limit: 5,
  });
  console.log(`[memory] created=${memoryId} searchCount=${results.length}`);
} else {
  console.log("[memory] skip (set CREATE_MEMORY=1 to create + search)");
}

if (process.env.RUN_AGENT === "1") {
  const response = await fetch(`${convexUrl}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      projectId,
      stream: false,
      messages: [{ role: "user", content: "smoke test: reply with ok" }],
    }),
  });
  const json = await response.json().catch(() => ({}));
  console.log(`[agent] status=${response.status}`);
  if (!response.ok) {
    console.log(`[agent] error=${JSON.stringify(json)}`);
    process.exit(1);
  }
  const last = Array.isArray(json?.messages) ? json.messages.at(-1)?.content : null;
  if (last) {
    console.log(`[agent] response=${String(last).slice(0, 200)}`);
  }
} else {
  console.log("[agent] skip (set RUN_AGENT=1 to run /ai/chat)");
}

if (createdProject && process.env.KEEP_PROJECT !== "1") {
  await client.mutation(anyApi.projects.remove, { id: projectId });
  console.log(`[convex] cleaned_project=${projectId}`);
} else if (createdProject) {
  console.log(`[convex] kept_project=${projectId}`);
}
BUN

bun "$tmp_script"
rm -f "$tmp_script"
