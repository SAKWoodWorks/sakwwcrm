# JavaScript Google Drive Watcher Design

## Goal

Move Google Drive watch registration and change processing from Python to the Node.js application while retaining Python for document extraction. Operators must be able to register, renew, inspect, and test the Drive watch without invoking Python directly.

## Scope

The migration covers:

- Google service-account authentication for Drive API calls
- `changes.watch` channel registration, renewal, and stopping
- persisted channel and page-token state
- paginated Drive change processing
- recursive filtering beneath the configured root folder
- dispatching accepted `.xlsx` files to the existing Python extractor
- operational logging and automated tests

The migration does not rewrite Excel parsing, filename parsing, product matching, PostgreSQL import logic, or Google Sheets updates. Those remain in the existing Python extraction pipeline.

## Architecture

### Shared Drive Module

Create a server-only TypeScript module responsible for:

- constructing an authenticated Google Drive v3 client from `GOOGLE_SERVICE_ACCOUNT_JSON`
- reading and atomically writing `GDRIVE_STATE_FILE`
- registering and stopping watch channels
- listing all pending changes from the saved page token
- checking whether a file is inside `GDRIVE_FOLDER_ID` or any descendant folder
- advancing the saved page token after a complete change-processing pass

The module will expose narrow operations for watch registration and pending-change processing. Google API details and state-file handling will not live in the route handler.

### Webhook Route

`POST /api/gdrive` will continue validating `x-goog-channel-token` with a timing-safe comparison and accepting only relevant Google resource states.

For `changes.watch` notifications, the route will acknowledge the webhook immediately, then start change processing in the persistent Docker Node.js process. A module-level single-flight lock will prevent overlapping runs. If a notification arrives while processing is active, a queued-rerun flag will cause one additional pass after the active pass finishes. This closes the race where a Drive change arrives after the active run's final API request but before its lock is released.

Legacy `files.watch` notifications will continue dispatching the referenced file to the Python extractor during the migration. The primary supported mode remains `changes.watch`.

### Extraction Boundary

The Node watcher will not download or parse spreadsheets. For each accepted Drive file it will invoke:

```text
PYTHON_VENV_PATH extraction/extract_file.py --file-id <id> --filename <name>
```

The child process will be awaited so failures can be logged and the next file can still be processed. Existing `sync_log` behavior remains authoritative for success, failure, retry, and the CRM Latest sync panel.

### Setup CLI

Add a JavaScript CLI at `scripts/setup-gdrive-watch.mjs` with these commands:

```text
node scripts/setup-gdrive-watch.mjs --webhook-url https://example.com/api/gdrive
node scripts/setup-gdrive-watch.mjs --stop
node scripts/setup-gdrive-watch.mjs --status
```

The CLI will import a Node-compatible JavaScript build of the shared Drive module, so production does not require a TypeScript runtime such as `tsx`. The build step will emit that small server utility alongside the CLI. Both the application and CLI will exercise the same exported operations; tests will verify that the emitted module remains compatible.

The CLI will use the same service-account credentials, state path, root-folder environment variable, and Drive module behavior as the application. Registration will stop the previous channel when possible, request a fresh start page token, register a new channel, and persist its expiration and webhook URL.

The production image will include the CLI and its required Node dependencies.

## State Compatibility

The existing JSON state shape at `/app/data/gdrive_watch_state.json` remains compatible:

- `channelId`
- `resourceId`
- `expiration`
- `expirationIso`
- `pageToken`
- `webhookUrl`
- `folderId`

No watch reset is required solely to deploy the migration. The JavaScript watcher can continue from the page token written by Python. A later renewal uses the JavaScript CLI.

State writes will use a temporary file followed by rename so an interrupted write cannot leave truncated JSON. Page tokens advance only after every page in the current response has been evaluated. Individual extraction failures are recorded by the extractor and do not prevent advancing past the Drive change.

## Folder Filtering

The configured root remains:

```text
1UrO8IvTlpYlltBNXZzTLiBgN4lyEEmtZ
```

For each `.xlsx` change, the watcher will walk parent metadata until it reaches the configured root or the parent chain ends. Results will be cached for the duration of a processing run. Metadata failures fail closed: the file is skipped and an error is logged rather than importing a file whose location cannot be verified.

## Error Handling And Logging

Logs will use consistent prefixes:

- `[gdrive-watch]` for notification and change-processing lifecycle
- `[gdrive-watch:error]` for Drive, state, and extraction failures
- `[gdrive-watch:skip]` for files outside scope or unsupported types

Secrets, access tokens, service-account JSON, and webhook channel tokens will never be logged. Errors processing one file will not terminate the entire batch. Missing credentials, missing state, or an invalid page token will terminate the run with a clear error while leaving the last valid state untouched.

## Migration

1. Add the Google Drive Node dependency and shared TypeScript module.
2. Add unit tests for authentication boundaries, state handling, pagination, recursive folder filtering, and single-flight processing.
3. Change `/api/gdrive` to invoke the TypeScript processor for `changes.watch` notifications.
4. Add and package the JavaScript setup CLI.
5. Add route tests for immediate acknowledgement, token rejection, deduplication, and processing errors.
6. Remove `gdrive_changes.py`, `setup_gdrive_watch.py`, and their Python watcher tests after JavaScript parity is verified.
7. Retain `gdrive_client.py` because the Python extractor still downloads Drive files.

## Testing

Vitest coverage will include:

- direct children and deeply nested subfolders
- files outside the configured root
- folder metadata lookup failures
- folder ancestry cache reuse
- multiple Drive change pages and final token persistence
- no token advancement when listing changes fails
- one failed extraction followed by successful processing of remaining files
- concurrent notifications sharing one active processing run
- a notification received at the end of an active run triggering one queued rerun
- watch register, stop, status, and state compatibility
- webhook authentication and immediate response behavior

Existing Python extraction tests, web tests, lint, and production build remain required. A production smoke test will renew the watch with Node, upload a valid new `.xlsx` in a nested folder, confirm `sync_log`, and verify the linked Latest sync entry in CRM.

## Deployment

Deploy with the normal Docker rebuild. Existing environment variables remain valid:

- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GDRIVE_WEBHOOK_TOKEN`
- `GDRIVE_FOLDER_ID`
- `GDRIVE_STATE_FILE`
- `PYTHON_VENV_PATH`
- `EXTRACTION_DIR`

After deployment, run the JavaScript CLI with `--status`. Renew the channel if it is expired or near expiration, then perform the nested-folder smoke test. Python remains installed because extraction still depends on it, but Drive watch administration no longer requires Python commands.
