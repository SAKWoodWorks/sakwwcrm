import io
import json
import os
from typing import Generator
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def _get_service():
    sa_json = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]
    info = json.loads(sa_json)
    creds = service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
    return build("drive", "v3", credentials=creds)


def download_file(file_id: str, dest_path: str) -> None:
    service = _get_service()
    request = service.files().get_media(fileId=file_id)
    with open(dest_path, "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()


def get_file_name(file_id: str) -> str:
    service = _get_service()
    meta = service.files().get(fileId=file_id, fields="name").execute()
    return meta["name"]


def list_files_in_folder(folder_id: str, mime_type: str = None) -> Generator[dict, None, None]:
    service = _get_service()
    query = f"'{folder_id}' in parents and trashed = false"
    if mime_type:
        query += f" and mimeType = '{mime_type}'"

    page_token = None
    while True:
        resp = service.files().list(
            q=query,
            fields="nextPageToken, files(id, name, mimeType)",
            pageToken=page_token,
            pageSize=100,
        ).execute()
        for f in resp.get("files", []):
            if f["mimeType"] == "application/vnd.google-apps.folder":
                yield from list_files_in_folder(f["id"], mime_type)
            else:
                yield f
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
