"""
Called by the /api/gdrive webhook when a changes.watch notification arrives.

Reads the stored page token, lists new xlsx files, extracts each one,
then advances the page token for the next call.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))

from gdrive_client import _get_service

_DEFAULT_STATE = Path(__file__).parent / ".gdrive_watch_state.json"
STATE_FILE = Path(os.environ.get("GDRIVE_STATE_FILE", str(_DEFAULT_STATE)))

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def is_in_folder_tree(service, parent_ids: list[str], root_folder_id: str, cache: dict[str, bool]) -> bool:
    """Return whether any parent is the configured root or one of its descendants."""
    visiting: set[str] = set()

    def folder_is_inside(folder_id: str) -> bool:
        if folder_id == root_folder_id:
            return True
        if folder_id in cache:
            return cache[folder_id]
        if folder_id in visiting:
            return False

        visiting.add(folder_id)
        try:
            folder = service.files().get(
                fileId=folder_id,
                fields="id,parents",
                supportsAllDrives=True,
            ).execute()
            result = any(folder_is_inside(parent_id) for parent_id in folder.get("parents", []))
        except Exception as error:
            print(f"Warning: could not verify Drive folder {folder_id}: {error}", file=sys.stderr)
            result = False
        finally:
            visiting.discard(folder_id)

        cache[folder_id] = result
        return result

    return any(folder_is_inside(parent_id) for parent_id in parent_ids)


def load_state() -> dict:
    if not STATE_FILE.exists():
        print(f"ERROR: state file not found: {STATE_FILE}", file=sys.stderr)
        print("Run setup_gdrive_watch.py first.", file=sys.stderr)
        sys.exit(1)
    return json.loads(STATE_FILE.read_text())


def save_page_token(token: str) -> None:
    state = load_state()
    state["pageToken"] = token
    STATE_FILE.write_text(json.dumps(state, indent=2))


def run_extract(file_id: str, filename: str) -> None:
    proc = subprocess.run(
        [sys.executable, "extract_file.py", "--file-id", file_id, "--filename", filename],
        cwd=Path(__file__).parent,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if proc.returncode == 0:
        print(f"[ok] {filename} ({file_id}): {proc.stdout.strip()}")
    else:
        print(f"[error] {filename} ({file_id}): {proc.stderr.strip()}", file=sys.stderr)


def process_changes() -> None:
    state = load_state()
    page_token = state.get("pageToken")
    folder_id = os.environ.get("GDRIVE_FOLDER_ID") or state.get("folderId")

    if not page_token:
        print("ERROR: no pageToken in state — re-run setup_gdrive_watch.py", file=sys.stderr)
        sys.exit(1)

    service = _get_service()
    current_token = page_token
    folder_cache: dict[str, bool] = {}

    while True:
        resp = service.changes().list(
            pageToken=current_token,
            fields="nextPageToken,newStartPageToken,changes(changeType,removed,fileId,file(id,name,mimeType,parents,trashed))",
            includeRemoved=False,
            spaces="drive",
        ).execute()

        for change in resp.get("changes", []):
            if change.get("changeType") != "file":
                continue
            if change.get("removed"):
                continue

            file_info = change.get("file", {})
            if file_info.get("trashed"):
                continue
            if file_info.get("mimeType") != XLSX_MIME:
                continue

            file_id = change.get("fileId", "")
            filename = file_info.get("name", "")

            if folder_id:
                parents = file_info.get("parents", [])
                if not is_in_folder_tree(service, parents, folder_id, folder_cache):
                    continue

            print(f"New xlsx: {filename} ({file_id})")
            run_extract(file_id, filename)

        next_token = resp.get("nextPageToken")
        new_start = resp.get("newStartPageToken")

        if next_token:
            current_token = next_token
        else:
            if new_start:
                save_page_token(new_start)
            break


if __name__ == "__main__":
    process_changes()
