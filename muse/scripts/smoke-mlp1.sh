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
CONVEX_ADMIN_KEY="${CONVEX_SELF_HOSTED_ADMIN_KEY:-${CONVEX_ADMIN_KEY:-}}"
CONVEX_ADMIN_SUBJECT="${CONVEX_ADMIN_SUBJECT:-admin|smoke}"

note "Qdrant URL: $QDRANT_URL"
note "Convex URL: $CONVEX_URL"

if require_cmd curl; then
  if [ -n "${QDRANT_API_KEY:-}" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -H "api-key: $QDRANT_API_KEY" \
      "$QDRANT_URL/collections/saga_unified" || true)
    note "qdrant saga_unified status: $status"
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      "$QDRANT_URL/collections/saga_unified" || true)
    note "qdrant saga_unified status (no key): $status"
  fi

  health_status=$(curl -s -o /dev/null -w "%{http_code}" "$CONVEX_URL/health" || true)
  note "convex /health status: $health_status"
fi

if [ -z "${CONVEX_AUTH_TOKEN:-}" ] && [ -z "$CONVEX_ADMIN_KEY" ]; then
  note "skip Convex tests (set CONVEX_AUTH_TOKEN or CONVEX_SELF_HOSTED_ADMIN_KEY to enable)"
  exit 0
fi

if ! require_cmd bun; then
  exit 1
fi

note "running Convex smoke steps"

tmp_script="$(mktemp)"
cat >"$tmp_script" <<'BUN'
const convexUrl = process.env.CONVEX_URL ?? "https://convex.rhei.team";
const token = process.env.CONVEX_AUTH_TOKEN ?? "";
const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY ?? process.env.CONVEX_ADMIN_KEY ?? "";
const adminSubject = process.env.CONVEX_ADMIN_SUBJECT ?? "admin|smoke";

const { ConvexHttpClient } = await import("convex/browser");
const { anyApi } = await import("convex/server");
const { convexToJson, jsonToConvex } = await import("convex/values");

let client = null;
let adminAuthHeader = "";

function encodeAdminIdentity(subject) {
  const raw = JSON.stringify({ subject });
  const encoded = Buffer.from(raw, "utf8").toString("base64");
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function adminRequest(path, args, kind) {
  const body =
    kind === "mutation"
      ? { path, format: "convex_encoded_json", args: [convexToJson(args)] }
      : { path, format: "convex_encoded_json", args: convexToJson(args) };

  const response = await fetch(`${convexUrl}/api/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Convex-Client": "smoke-mlp1",
      Authorization: `Convex ${adminAuthHeader}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && response.status !== 400) {
    throw new Error(await response.text());
  }

  const json = await response.json();
  if (json.status === "success") {
    return jsonToConvex(json.value);
  }
  throw new Error(json.errorMessage ?? "Convex admin request failed");
}

if (token) {
  client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  console.log("[convex] auth=token");
} else if (adminKey) {
  adminAuthHeader = `${adminKey}:${encodeAdminIdentity(adminSubject)}`;
  console.log(`[convex] auth=admin subject=${adminSubject}`);
} else {
  console.log("[convex] missing auth (set CONVEX_AUTH_TOKEN or CONVEX_SELF_HOSTED_ADMIN_KEY)");
  process.exit(1);
}

let projectId = process.env.PROJECT_ID;
let createdProject = false;

if (!projectId) {
  const name = `Smoke Test ${new Date().toISOString()}`;
  if (client) {
    projectId = await client.mutation(anyApi.projects.create, {
      name,
      description: "MLP1 smoke test",
    });
  } else {
    projectId = await adminRequest("projects.create", {
      name,
      description: "MLP1 smoke test",
    }, "mutation");
  }
  createdProject = true;
}

console.log(`[convex] projectId=${projectId}`);

if (process.env.CREATE_MEMORY === "1") {
  const memoryArgs = {
    projectId,
    text: "smoke test memory",
    type: "note",
    confidence: 0.5,
    source: "user",
  };
  const memoryId = client
    ? await client.mutation(anyApi.memories.create, memoryArgs)
    : await adminRequest("memories.create", memoryArgs, "mutation");
  const results = client
    ? await client.query(anyApi.memories.search, {
        projectId,
        searchQuery: "smoke",
        limit: 5,
      })
    : await adminRequest(
        "memories.search",
        { projectId, searchQuery: "smoke", limit: 5 },
        "query"
      );
  console.log(`[memory] created=${memoryId} searchCount=${results.length}`);
} else {
  console.log("[memory] skip (set CREATE_MEMORY=1 to create + search)");
}

if (process.env.RUN_AGENT === "1") {
  if (!token) {
    console.log("[agent] skip (RUN_AGENT=1 requires CONVEX_AUTH_TOKEN)");
    process.exit(0);
  }
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
  if (client) {
    await client.mutation(anyApi.projects.remove, { id: projectId });
  } else {
    await adminRequest("projects.remove", { id: projectId }, "mutation");
  }
  console.log(`[convex] cleaned_project=${projectId}`);
} else if (createdProject) {
  console.log(`[convex] kept_project=${projectId}`);
}
BUN

bun "$tmp_script"
rm -f "$tmp_script"
