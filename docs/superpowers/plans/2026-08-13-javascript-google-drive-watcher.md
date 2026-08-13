# JavaScript Google Drive Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Python-based Google Drive watch administration and change traversal with tested Node.js/TypeScript code while retaining Python only for document extraction.

**Architecture:** Server-only TypeScript modules will own Google authentication, atomic state persistence, recursive folder membership, paginated change processing, extraction dispatch, and watch lifecycle. The webhook will queue that processor with a single-flight/rerun guard, while an esbuild-generated Node CLI will reuse the same source for register, stop, and status commands in the production container.

**Tech Stack:** Next.js 16 App Router, TypeScript 6, Vitest 4, `googleapis`, Node.js 22, esbuild, Docker, existing Python extraction virtual environment

**Spec:** `docs/superpowers/specs/2026-08-13-javascript-google-drive-watcher-design.md`

## Global Constraints

- Keep Python for `extract_file.py`, Excel parsing, product matching, database writes, and Google Sheets updates.
- Preserve compatibility with `/app/data/gdrive_watch_state.json` and its existing camelCase fields.
- Continue using `GOOGLE_SERVICE_ACCOUNT_JSON`, `GDRIVE_WEBHOOK_TOKEN`, `GDRIVE_FOLDER_ID`, `GDRIVE_STATE_FILE`, `PYTHON_VENV_PATH`, and `EXTRACTION_DIR`.
- Restrict automatic imports to folder `1UrO8IvTlpYlltBNXZzTLiBgN4lyEEmtZ` and all descendant folders.
- Acknowledge Google webhook requests immediately; do not await Drive processing in the response path.
- Do not log credentials, access tokens, service-account JSON, or webhook channel tokens.
- Use test-first red/green cycles for every production behavior.
- Leave unrelated untracked files (`.superpowers/`, the stock workbook, and `server`) untouched.

---

### Task 1: Google Drive Client And Atomic Watch State

**Files:**
- Create: `src/lib/gdrive/types.ts`
- Create: `src/lib/gdrive/client.ts`
- Create: `src/lib/gdrive/state.ts`
- Create: `src/__tests__/gdrive-state.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `DriveWatchState`, `DriveFileChange`, and `DriveApi` types in `types.ts`.
- Produces: `createDriveApi(serviceAccountJson?: string): Promise<DriveApi>` in `client.ts`.
- Produces: `resolveStatePath()`, `readDriveWatchState()`, and `writeDriveWatchState(state)` in `state.ts`.
- State functions consume an optional explicit path in tests and default to `GDRIVE_STATE_FILE` or `extraction/.gdrive_watch_state.json`.

- [ ] **Step 1: Add dependencies**

Run:

```bash
npm install googleapis
npm install --save-dev esbuild
```

Expected: `googleapis` appears under `dependencies`, `esbuild` appears under `devDependencies`, and the lockfile updates without changing Vitest versions.

- [ ] **Step 2: Write failing state tests**

Create `src/__tests__/gdrive-state.test.ts` with real temporary files:

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { readDriveWatchState, writeDriveWatchState } from "@/lib/gdrive/state"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("Drive watch state", () => {
  it("reads the existing Python-compatible state shape", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "gdrive-state-"))
    dirs.push(dir)
    const file = path.join(dir, "state.json")
    await writeFile(file, JSON.stringify({ pageToken: "123", folderId: "root", channelId: "channel" }))

    await expect(readDriveWatchState(file)).resolves.toMatchObject({
      pageToken: "123",
      folderId: "root",
      channelId: "channel",
    })
  })

  it("writes state atomically without leaving a temporary file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "gdrive-state-"))
    dirs.push(dir)
    const file = path.join(dir, "state.json")

    await writeDriveWatchState({ pageToken: "456", folderId: "root" }, file)

    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ pageToken: "456", folderId: "root" })
    await expect(readFile(`${file}.tmp`, "utf8")).rejects.toThrow()
  })

  it("rejects malformed JSON without replacing the state", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "gdrive-state-"))
    dirs.push(dir)
    const file = path.join(dir, "state.json")
    await writeFile(file, "not-json")

    await expect(readDriveWatchState(file)).rejects.toThrow("Invalid Google Drive watch state")
    await expect(readFile(file, "utf8")).resolves.toBe("not-json")
  })
})
```

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
npx vitest run src/__tests__/gdrive-state.test.ts
```

Expected: FAIL because `@/lib/gdrive/state` does not exist.

- [ ] **Step 4: Implement the types, authenticated client, and state store**

Define the shared state type exactly as:

```ts
export type DriveWatchState = {
  channelId?: string
  resourceId?: string
  expiration?: number
  expirationIso?: string
  pageToken: string
  webhookUrl?: string
  folderId?: string | null
}
```

Define a narrow `DriveApi` interface containing only the operations later tasks consume: `getStartPageToken`, `watchChanges`, `stopChannel`, `listChanges`, and `getFileParents`. Implement `createDriveApi` with `google.auth.GoogleAuth`, JSON parsing of `GOOGLE_SERVICE_ACCOUNT_JSON`, Drive readonly scope, `supportsAllDrives: true`, and `includeItemsFromAllDrives: true` where supported.

Implement state persistence with `mkdir(dirname(path), { recursive: true })`, write to `${path}.tmp`, then `rename` to the target. Wrap JSON parse failures with `Invalid Google Drive watch state: <path>` and preserve the original file.

- [ ] **Step 5: Run the state tests and project lint**

Run:

```bash
npx vitest run src/__tests__/gdrive-state.test.ts
npm run lint
```

Expected: state tests PASS and lint exits 0.

- [ ] **Step 6: Commit Task 1**

```bash
git add package.json package-lock.json src/lib/gdrive/types.ts src/lib/gdrive/client.ts src/lib/gdrive/state.ts src/__tests__/gdrive-state.test.ts
git commit -m "feat: add Node Google Drive state client"
```

---

### Task 2: Recursive Folder Filtering And Paginated Change Processing

**Files:**
- Create: `src/lib/gdrive/changes.ts`
- Create: `src/__tests__/gdrive-changes.test.ts`

**Interfaces:**
- Consumes: `DriveApi`, `DriveFileChange`, `DriveWatchState`, `readDriveWatchState`, and `writeDriveWatchState` from Task 1.
- Produces: `isInFolderTree(api, parentIds, rootFolderId, cache): Promise<boolean>`.
- Produces: `processDriveChanges(deps?): Promise<{ processed: number; skipped: number; failed: number }>`.
- `processDriveChanges` dependency injection accepts `{ api, extractFile, readState, writeState, rootFolderId, log }` so tests do not access Google, disk, or Python.

- [ ] **Step 1: Write failing folder traversal tests**

Add literal fixtures in `src/__tests__/gdrive-changes.test.ts` covering:

```ts
it("accepts direct children without metadata lookup", async () => {
  const api = fakeDriveApi({})
  await expect(isInFolderTree(api, [ROOT], ROOT, new Map())).resolves.toBe(true)
  expect(api.getFileParents).not.toHaveBeenCalled()
})

it("accepts nested descendants and reuses the cache", async () => {
  const api = fakeDriveApi({ month: ["year"], year: [ROOT] })
  const cache = new Map<string, boolean>()
  await expect(isInFolderTree(api, ["month"], ROOT, cache)).resolves.toBe(true)
  await expect(isInFolderTree(api, ["month"], ROOT, cache)).resolves.toBe(true)
  expect(api.getFileParents).toHaveBeenCalledTimes(2)
})

it("fails closed when parent metadata cannot be read", async () => {
  const api = fakeDriveApi({})
  vi.mocked(api.getFileParents).mockRejectedValue(new Error("Drive unavailable"))
  await expect(isInFolderTree(api, ["unknown"], ROOT, new Map())).resolves.toBe(false)
})
```

The test helper must return a complete `DriveApi` fake, with all methods defined and unused methods rejecting if unexpectedly called.

- [ ] **Step 2: Write failing pagination and token tests**

Add tests where `listChanges("token-1")` returns a page with `nextPageToken: "token-2"`, and the second page returns `newStartPageToken: "token-3"`. Assert:

- only non-trashed `.xlsx` files inside `ROOT` call `extractFile(id, name)`
- a failed extractor increments `failed`, processing continues, and `token-3` is persisted
- `writeState` is called once after all pages, preserving channel fields while changing only `pageToken`
- if the first `listChanges` rejects, `writeState` is never called

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
npx vitest run src/__tests__/gdrive-changes.test.ts
```

Expected: FAIL because `@/lib/gdrive/changes` does not exist.

- [ ] **Step 4: Implement folder traversal and processing**

Implement traversal with a per-run `Map<string, boolean>` and a per-call `Set<string>` to prevent cycles. Log lookup failures as `[gdrive-watch:error] could not verify folder <id>: <message>` and return false.

Implement processing with these exact filters:

```ts
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

if (change.changeType !== "file" || change.removed) continue
if (!change.file || change.file.trashed) continue
if (change.file.mimeType !== XLSX_MIME) continue
```

Resolve the root folder from the injected value, then `process.env.GDRIVE_FOLDER_ID`, then state `folderId`. Throw if no page token exists. Await extraction one file at a time to preserve readable logs and avoid overloading Google Sheets. Persist only the final `newStartPageToken`; if a page has only `nextPageToken`, continue listing rather than persisting intermediate state.

- [ ] **Step 5: Run focused and full web tests**

Run:

```bash
npx vitest run src/__tests__/gdrive-changes.test.ts
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/lib/gdrive/changes.ts src/__tests__/gdrive-changes.test.ts
git commit -m "feat: process Drive changes in TypeScript"
```

---

### Task 3: Python Extraction Dispatch And Single-Flight Queue

**Files:**
- Create: `src/lib/gdrive/extractor.ts`
- Create: `src/lib/gdrive/queue.ts`
- Create: `src/__tests__/gdrive-extractor.test.ts`
- Create: `src/__tests__/gdrive-queue.test.ts`

**Interfaces:**
- Produces: `extractDriveFile(fileId: string, filename: string): Promise<void>`.
- Produces: `queueDriveChangeProcessing(processor?: () => Promise<unknown>): void`.
- Consumes: `processDriveChanges` from Task 2 as the queue's default processor.

- [ ] **Step 1: Write the failing extractor test**

Mock `node:child_process` `execFile` and assert the observable boundary:

```ts
expect(execFile).toHaveBeenCalledWith(
  "/app/extraction/.venv/bin/python",
  ["/app/extraction/extract_file.py", "--file-id", "file-1", "--filename", "invoice.xlsx"],
  expect.objectContaining({ cwd: "/app/extraction" }),
  expect.any(Function),
)
```

Add one success case and one case where the callback receives an error and `extractDriveFile` rejects with filename context.

- [ ] **Step 2: Write failing queue race tests**

Use deferred promises to prove:

- two notifications during one active run do not overlap processors
- a notification received during the active run schedules exactly one second pass
- processor rejection is caught and logged, and a later notification can start a fresh run

Use `vi.resetModules()` between tests rather than adding a production reset function.

- [ ] **Step 3: Run both files and verify RED**

Run:

```bash
npx vitest run src/__tests__/gdrive-extractor.test.ts src/__tests__/gdrive-queue.test.ts
```

Expected: FAIL because extractor and queue modules do not exist.

- [ ] **Step 4: Implement extraction dispatch**

Resolve:

```ts
const extractionDir = process.env.EXTRACTION_DIR ?? path.join(process.cwd(), "extraction")
const python = process.env.PYTHON_VENV_PATH ?? path.join(extractionDir, ".venv", "bin", "python")
```

Promisify `execFile` without using `shell: true`. Pass `--file-id` and `--filename` as distinct arguments. Include captured stderr in rejection messages but never environment variables.

- [ ] **Step 5: Implement the single-flight/rerun queue**

Keep module-level `running` and `rerunRequested` state. `queueDriveChangeProcessing` returns immediately. Its background loop runs the processor, repeats once when `rerunRequested` was set, and catches/logs every run as `[gdrive-watch:error] <message>`. A notification during the rerun may set the flag for one further pass, ensuring no notification race is discarded.

- [ ] **Step 6: Run focused tests, lint, and full tests**

Run:

```bash
npx vitest run src/__tests__/gdrive-extractor.test.ts src/__tests__/gdrive-queue.test.ts
npm run lint
npm test
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/lib/gdrive/extractor.ts src/lib/gdrive/queue.ts src/__tests__/gdrive-extractor.test.ts src/__tests__/gdrive-queue.test.ts
git commit -m "feat: queue Drive imports through Python extractor"
```

---

### Task 4: Webhook Route Migration

**Files:**
- Modify: `src/app/api/gdrive/route.ts`
- Create: `src/__tests__/gdrive-webhook.test.ts`

**Interfaces:**
- Consumes: `queueDriveChangeProcessing()` from Task 3.
- Preserves: `POST(request: NextRequest): Promise<NextResponse>` and existing timing-safe webhook token validation.

- [ ] **Step 1: Write failing route tests**

Mock `@/lib/gdrive/queue` and `node:child_process`. Cover:

```ts
it("rejects an invalid channel token", async () => {
  const response = await POST(gdriveRequest({ token: "wrong", state: "update", uri: CHANGES_URI }))
  expect(response.status).toBe(401)
  expect(queueDriveChangeProcessing).not.toHaveBeenCalled()
})

it("acknowledges a changes notification and queues Node processing", async () => {
  const response = await POST(gdriveRequest({ token: SECRET, state: "update", uri: CHANGES_URI }))
  expect(response.status).toBe(200)
  expect(queueDriveChangeProcessing).toHaveBeenCalledOnce()
})

it("does not queue the initial sync handshake", async () => {
  const response = await POST(gdriveRequest({ token: SECRET, state: "sync", uri: CHANGES_URI }))
  expect(response.status).toBe(200)
  expect(queueDriveChangeProcessing).not.toHaveBeenCalled()
})
```

Retain a test that legacy `files.watch` invokes the Python extractor path until that mode is intentionally removed.

- [ ] **Step 2: Run the route test and verify RED**

Run:

```bash
npx vitest run src/__tests__/gdrive-webhook.test.ts
```

Expected: FAIL because changes notifications still spawn `gdrive_changes.py`.

- [ ] **Step 3: Modify the route minimally**

Import `queueDriveChangeProcessing`. For a `/changes` resource URI, retain the existing 60-second notification dedupe, call the queue function synchronously, and return HTTP 200. Remove only the `gdrive_changes.py` spawn branch; preserve token validation, handshake behavior, and legacy file watch extraction.

- [ ] **Step 4: Run route, full tests, and lint**

Run:

```bash
npx vitest run src/__tests__/gdrive-webhook.test.ts
npm test
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/app/api/gdrive/route.ts src/__tests__/gdrive-webhook.test.ts
git commit -m "feat: process Drive webhooks in Node"
```

---

### Task 5: JavaScript Watch Lifecycle CLI

**Files:**
- Create: `src/lib/gdrive/watch.ts`
- Create: `src/__tests__/gdrive-watch.test.ts`
- Create: `scripts/setup-gdrive-watch.ts`
- Create: `scripts/build-gdrive-cli.mjs`
- Create: `src/__tests__/gdrive-cli-build.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `registerDriveWatch(webhookUrl: string, deps?): Promise<DriveWatchState>`.
- Produces: `stopDriveWatch(deps?): Promise<boolean>`.
- Produces: `getDriveWatchStatus(path?): Promise<DriveWatchState | null>`.
- CLI accepts exactly one mode: `--webhook-url <https-url>`, `--stop`, or `--status`.

- [ ] **Step 1: Write failing watch lifecycle tests**

Test with a complete fake `DriveApi` and in-memory state functions. Assert registration:

- rejects non-HTTPS webhook URLs
- attempts to stop a prior channel when `channelId` and `resourceId` exist
- obtains a fresh page token before `watchChanges`
- passes `GDRIVE_WEBHOOK_TOKEN` as the Google channel token without logging it
- writes `channelId`, `resourceId`, numeric expiration, ISO expiration, page token, webhook URL, and configured folder ID

Assert stop removes `channelId` and `resourceId` only after the Drive stop call succeeds. Assert status returns null when the state file is missing but rethrows malformed state.

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run:

```bash
npx vitest run src/__tests__/gdrive-watch.test.ts
```

Expected: FAIL because `@/lib/gdrive/watch` does not exist.

- [ ] **Step 3: Implement lifecycle functions**

Use `randomUUID()` for channel IDs. Require `GDRIVE_WEBHOOK_TOKEN` for registration, but not status. Store `folderId` from `GDRIVE_FOLDER_ID`. On prior-channel stop failure, log a warning and continue registration, matching current operational behavior.

- [ ] **Step 4: Write the CLI entry and build script**

The TypeScript CLI must parse `process.argv`, call one lifecycle function, print only non-secret status fields, and set `process.exitCode = 1` on errors.

`scripts/build-gdrive-cli.mjs` must call esbuild with:

```js
await build({
  entryPoints: ["scripts/setup-gdrive-watch.ts"],
  outfile: "dist/setup-gdrive-watch.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  banner: { js: "#!/usr/bin/env node" },
})
```

Add scripts:

```json
"build:gdrive-cli": "node scripts/build-gdrive-cli.mjs",
"gdrive:watch": "node dist/setup-gdrive-watch.mjs"
```

Change the existing build script to `npm run build:gdrive-cli && next build`.

- [ ] **Step 5: Write and run CLI build verification**

Create `src/__tests__/gdrive-cli-build.test.ts` that runs `npm run build:gdrive-cli` with `execFile`, verifies `dist/setup-gdrive-watch.mjs` exists, then runs it with `--status` against a temporary `GDRIVE_STATE_FILE` containing a Python-compatible fixture. Assert exit 0 and output includes the webhook URL and expiration but excludes `GDRIVE_WEBHOOK_TOKEN` and `GOOGLE_SERVICE_ACCOUNT_JSON` fixture values.

Run:

```bash
npx vitest run src/__tests__/gdrive-watch.test.ts src/__tests__/gdrive-cli-build.test.ts
```

Expected: both files PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add package.json package-lock.json src/lib/gdrive/watch.ts src/__tests__/gdrive-watch.test.ts scripts/setup-gdrive-watch.ts scripts/build-gdrive-cli.mjs src/__tests__/gdrive-cli-build.test.ts
git commit -m "feat: add Node Drive watch CLI"
```

---

### Task 6: Production Image Packaging And Operator Commands

**Files:**
- Modify: `Dockerfile`
- Modify: `.dockerignore`
- Modify: `docker-compose.yml`
- Create: `scripts/gdrive-watch-entrypoint.sh`
- Create: `src/__tests__/gdrive-docker-config.test.ts`

**Interfaces:**
- Consumes: `dist/setup-gdrive-watch.mjs` from Task 5.
- Produces: container command `docker compose exec -T crm npm run gdrive:watch -- --status` and equivalent register/stop commands.

- [ ] **Step 1: Write failing Docker packaging test**

Create a test that reads the Docker files and asserts behavior-relevant configuration:

- builder runs `npm run build`, which emits the CLI
- runner copies `dist/setup-gdrive-watch.mjs`, `package.json`, and required runtime Node modules
- runner includes `scripts/gdrive-watch-entrypoint.sh`
- Compose retains `GDRIVE_STATE_FILE` and `GDRIVE_FOLDER_ID`
- `.dockerignore` does not exclude `scripts/`

Do not assert irrelevant whitespace or full file snapshots.

- [ ] **Step 2: Run the Docker test and verify RED**

Run:

```bash
npx vitest run src/__tests__/gdrive-docker-config.test.ts
```

Expected: FAIL because the CLI artifact is not copied to the runner image.

- [ ] **Step 3: Package the CLI**

Copy `dist/setup-gdrive-watch.mjs` and the small shell entrypoint into the runner. The entrypoint must execute:

```sh
#!/bin/sh
exec node /app/dist/setup-gdrive-watch.mjs "$@"
```

Add package scripts for status convenience only if they work in the standalone runner. Prefer the direct stable command:

```bash
docker compose exec -T crm node /app/dist/setup-gdrive-watch.mjs --status
```

Use the `googleapis` runtime dependency traced into Next's standalone output. Keep `packages: "external"` in the CLI build, copy the standalone output to `/app` before the CLI artifact, and prove module resolution by executing the CLI inside the runner image. A container failure to resolve `googleapis` is a Task 6 failure and must be fixed by adding `googleapis` to `next.config.ts` `serverExternalPackages`, not by introducing a second packaging strategy.

- [ ] **Step 4: Verify the built image artifact without production secrets**

Run:

```bash
npm run build:gdrive-cli
node dist/setup-gdrive-watch.mjs --status
docker build --target runner -t new-crm:gdrive-watcher-test .
docker run --rm --entrypoint node new-crm:gdrive-watcher-test /app/dist/setup-gdrive-watch.mjs --status
```

Expected: both status commands exit cleanly and report that no state exists; Docker build exits 0. If Docker is unavailable, record that limitation and still require the local artifact test and production Next build.

- [ ] **Step 5: Run Docker config test and production build**

Run:

```bash
npx vitest run src/__tests__/gdrive-docker-config.test.ts
npm run build
```

Expected: test PASS and production build exits 0.

- [ ] **Step 6: Commit Task 6**

```bash
git add Dockerfile .dockerignore docker-compose.yml scripts/gdrive-watch-entrypoint.sh src/__tests__/gdrive-docker-config.test.ts
git commit -m "build: package Node Drive watcher CLI"
```

---

### Task 7: Remove Python Watch Administration And Verify Migration

**Files:**
- Delete: `extraction/gdrive_changes.py`
- Delete: `extraction/setup_gdrive_watch.py`
- Delete: `extraction/tests/test_gdrive_changes.py`
- Modify: `AGENTS.md` only if it is tracked in the execution environment; otherwise leave repository-ignored local instructions unchanged.
- Modify: `PROJECT.md` only if it is tracked in the execution environment; otherwise leave repository-ignored local documentation unchanged.

**Interfaces:**
- Retains: `extraction/gdrive_client.py` because `extract_file.py` still downloads Drive files.
- Retains: persisted state compatibility and all environment variables listed in Global Constraints.

- [ ] **Step 1: Prove no runtime references remain**

Run:

```bash
rg -n "gdrive_changes\.py|setup_gdrive_watch\.py" src scripts Dockerfile docker-compose.yml package.json
```

Expected before deletion: no Node runtime reference remains; references may exist only in the Python files and documentation scheduled for update.

- [ ] **Step 2: Delete superseded Python watcher files**

Delete only the three listed files. Do not remove `gdrive_client.py`, `extract_file.py`, Google Python dependencies, or the Python virtual environment setup from Docker.

- [ ] **Step 3: Update tracked operator documentation**

Replace Python watch setup examples with:

```bash
docker compose exec -T crm node /app/dist/setup-gdrive-watch.mjs --status
docker compose exec -T crm node /app/dist/setup-gdrive-watch.mjs --webhook-url "$CRM_GDRIVE_WEBHOOK_URL"
docker compose exec -T crm node /app/dist/setup-gdrive-watch.mjs --stop
```

State explicitly that Python remains required for extraction.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm run lint
npm test
npm run build
extraction/.venv/Scripts/python -m pytest extraction/tests --ignore=extraction/tests/test_db.py
git diff --check
```

Expected:

- lint exits 0
- all Vitest files pass
- production Next and CLI build exits 0
- non-database Python extraction tests pass; database tests remain separately dependent on a running PostgreSQL instance
- no whitespace errors

- [ ] **Step 5: Inspect final scope**

Run:

```bash
git status --short
git diff --stat
rg -n "gdrive_changes\.py|setup_gdrive_watch\.py" . --glob '!docs/superpowers/**' --glob '!.git/**'
```

Expected: only intended migration files are modified; the final search returns no obsolete runtime references. Unrelated untracked files remain untouched.

- [ ] **Step 6: Commit Task 7**

```bash
git add -u extraction src scripts Dockerfile .dockerignore docker-compose.yml package.json package-lock.json
git add docs/superpowers/plans/2026-08-13-javascript-google-drive-watcher.md
git commit -m "refactor: complete Node Drive watcher migration"
```

---

### Task 8: Production Smoke Test And Deployment Handoff

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: deployed Docker image, configured Google service account, persisted watch state, and CRM Import page.
- Produces: operational evidence that registration, nested-folder filtering, extraction, `sync_log`, and Latest sync work end to end.

- [ ] **Step 1: Deploy the built revision**

On production:

```bash
git pull
docker compose up -d --build crm
```

Expected: CRM container becomes healthy/running with the new image.

- [ ] **Step 2: Inspect watch status using Node**

```bash
docker compose exec -T crm node /app/dist/setup-gdrive-watch.mjs --status
```

Expected: output includes webhook URL, expiration, root folder ID, and page-token presence; it does not print secrets.

- [ ] **Step 3: Renew if expired or near expiration**

```bash
docker compose exec -T crm node /app/dist/setup-gdrive-watch.mjs --webhook-url "$CRM_GDRIVE_WEBHOOK_URL"
```

Expected: a new channel ID and expiration are persisted. Before running the command, set `CRM_GDRIVE_WEBHOOK_URL` in the operator shell to the production HTTPS `/api/gdrive` URL; the CLI rejects an empty or non-HTTPS value.

- [ ] **Step 4: Upload a new valid workbook in a nested folder**

Upload a previously unseen, valid `.xlsx` invoice beneath Drive folder `1UrO8IvTlpYlltBNXZzTLiBgN4lyEEmtZ`. Do not reuse an already synced Drive file ID.

- [ ] **Step 5: Verify logs and database evidence**

```bash
docker compose logs --since=5m crm
docker compose exec -T db psql -U crm -d crm_db -c "SELECT filename, status, error_msg, processed_at FROM sync_log ORDER BY processed_at DESC LIMIT 5;"
```

Expected: logs show `[gdrive-watch]` processing and the query shows the uploaded filename with `success`.

- [ ] **Step 6: Verify the CRM Latest sync link**

Open `/th/crm/import`, confirm `ซิงค์ล่าสุด` shows the new file and success status, and click the filename. Expected: the exact Google Drive file opens in a new tab.

- [ ] **Step 7: Report deployment result**

Record the deployed commit, watch expiration, test filename, `sync_log` status, and whether the CRM link opened the correct file. Do not include tokens or credential material.
