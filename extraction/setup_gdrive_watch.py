"""
Register a Google Drive changes.watch channel so the server gets push
notifications when new files are uploaded.

Usage (run once, then again before expiration ~every 6 days):
    python setup_gdrive_watch.py --webhook-url https://your-server.com/api/gdrive
    python setup_gdrive_watch.py --webhook-url https://your-server.com/api/gdrive --folder-id <FOLDER_ID>
    python setup_gdrive_watch.py --stop   # stop existing channel only

State (channel ID + page token) is saved to the path in GDRIVE_STATE_FILE env
var (default: .gdrive_watch_state.json next to this script).
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))

from gdrive_client import _get_service

_DEFAULT_STATE = Path(__file__).parent / ".gdrive_watch_state.json"
STATE_FILE = Path(os.environ.get("GDRIVE_STATE_FILE", str(_DEFAULT_STATE)))


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))
    print(f"State saved → {STATE_FILE}")


def stop_channel(service, state: dict) -> bool:
    channel_id = state.get("channelId")
    resource_id = state.get("resourceId")
    if not channel_id or not resource_id:
        return False
    try:
        service.channels().stop(body={"id": channel_id, "resourceId": resource_id}).execute()
        print(f"Stopped channel: {channel_id}")
        return True
    except Exception as e:
        print(f"Warning: could not stop channel: {e}", file=sys.stderr)
        return False


def register(webhook_url: str, folder_id: str | None) -> None:
    token = os.environ.get("GDRIVE_WEBHOOK_TOKEN")
    if not token:
        print("ERROR: GDRIVE_WEBHOOK_TOKEN not set in environment", file=sys.stderr)
        sys.exit(1)

    service = _get_service()
    state = load_state()

    # Stop previous channel if exists
    stop_channel(service, state)

    # Fresh start page token — only future changes will be processed
    page_token = service.changes().getStartPageToken().execute()["startPageToken"]

    body = {
        "id": str(uuid.uuid4()),
        "type": "web_hook",
        "address": webhook_url,
        "token": token,
    }
    result = service.changes().watch(pageToken=page_token, body=body).execute()

    expiration_ms = int(result.get("expiration", 0))
    expiration_iso = (
        datetime.fromtimestamp(expiration_ms / 1000, tz=timezone.utc).isoformat()
        if expiration_ms else "unknown"
    )

    new_state = {
        "channelId": result["id"],
        "resourceId": result["resourceId"],
        "expiration": expiration_ms,
        "expirationIso": expiration_iso,
        "pageToken": page_token,
        "webhookUrl": webhook_url,
        "folderId": folder_id,
    }
    save_state(new_state)

    print("Watch registered:")
    print(f"  Channel ID  : {result['id']}")
    print(f"  Expires     : {expiration_iso}")
    print(f"  Page token  : {page_token}")
    if folder_id:
        print(f"  Folder ID   : {folder_id} (new files outside this folder will be ignored)")
    print()
    print("Schedule renewal before expiration:")
    print(f"  python setup_gdrive_watch.py --webhook-url {webhook_url}" + (f" --folder-id {folder_id}" if folder_id else ""))


def stop_only() -> None:
    service = _get_service()
    state = load_state()
    if stop_channel(service, state):
        state.pop("channelId", None)
        state.pop("resourceId", None)
        save_state(state)
    else:
        print("No active channel found in state file.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--webhook-url", help="Public HTTPS URL of /api/gdrive")
    parser.add_argument(
        "--folder-id",
        default=os.environ.get("GDRIVE_FOLDER_ID"),
        help="Only process xlsx files in this folder or its subfolders (defaults to GDRIVE_FOLDER_ID)",
    )
    parser.add_argument("--stop", action="store_true", help="Stop existing channel and exit")
    args = parser.parse_args()

    if args.stop:
        stop_only()
    elif not args.webhook_url:
        parser.error("--webhook-url is required unless --stop is used")
    else:
        register(args.webhook_url, args.folder_id)
