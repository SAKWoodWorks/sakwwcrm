from unittest.mock import MagicMock

import gdrive_changes


ROOT_FOLDER_ID = "1UrO8IvTlpYlltBNXZzTLiBgN4lyEEmtZ"


def drive_service_with_parents(parent_map):
    service = MagicMock()
    files = service.files.return_value

    def get_file(*, fileId, fields, supportsAllDrives):
        request = MagicMock()
        request.execute.return_value = {
            "id": fileId,
            "parents": parent_map.get(fileId, []),
        }
        return request

    files.get.side_effect = get_file
    return service


def test_accepts_file_directly_inside_sync_root_without_metadata_lookup():
    service = drive_service_with_parents({})

    result = gdrive_changes.is_in_folder_tree(
        service,
        [ROOT_FOLDER_ID],
        ROOT_FOLDER_ID,
        {},
    )

    assert result is True
    service.files.return_value.get.assert_not_called()


def test_accepts_file_inside_nested_subfolder():
    service = drive_service_with_parents({
        "year-folder": [ROOT_FOLDER_ID],
        "month-folder": ["year-folder"],
    })

    result = gdrive_changes.is_in_folder_tree(
        service,
        ["month-folder"],
        ROOT_FOLDER_ID,
        {},
    )

    assert result is True


def test_rejects_file_outside_sync_root():
    service = drive_service_with_parents({
        "other-folder": ["other-root"],
        "other-root": [],
    })

    result = gdrive_changes.is_in_folder_tree(
        service,
        ["other-folder"],
        ROOT_FOLDER_ID,
        {},
    )

    assert result is False


def test_rejects_file_when_parent_metadata_cannot_be_verified():
    service = MagicMock()
    service.files.return_value.get.side_effect = RuntimeError("Drive unavailable")

    result = gdrive_changes.is_in_folder_tree(
        service,
        ["unknown-folder"],
        ROOT_FOLDER_ID,
        {},
    )

    assert result is False


def test_reuses_parent_cache_for_files_in_same_subfolder():
    service = drive_service_with_parents({"shared-folder": [ROOT_FOLDER_ID]})
    cache = {}

    assert gdrive_changes.is_in_folder_tree(service, ["shared-folder"], ROOT_FOLDER_ID, cache) is True
    assert gdrive_changes.is_in_folder_tree(service, ["shared-folder"], ROOT_FOLDER_ID, cache) is True
    assert service.files.return_value.get.call_count == 1


def test_process_changes_requests_shared_drive_changes(monkeypatch):
    service = MagicMock()
    changes = service.changes.return_value
    changes.list.return_value.execute.return_value = {"changes": [], "newStartPageToken": "next-token"}
    monkeypatch.setattr(gdrive_changes, "_get_service", lambda: service)
    monkeypatch.setattr(gdrive_changes, "load_state", lambda: {"pageToken": "start-token"})
    saved_tokens = []
    monkeypatch.setattr(gdrive_changes, "save_page_token", saved_tokens.append)

    gdrive_changes.process_changes()

    changes.list.assert_called_once()
    kwargs = changes.list.call_args.kwargs
    assert kwargs["supportsAllDrives"] is True
    assert kwargs["includeItemsFromAllDrives"] is True
    assert saved_tokens == ["next-token"]
