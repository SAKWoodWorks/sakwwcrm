from unittest.mock import MagicMock

import setup_gdrive_watch


def test_register_requests_shared_drive_watch_support(monkeypatch):
    service = MagicMock()
    changes = service.changes.return_value
    changes.getStartPageToken.return_value.execute.return_value = {"startPageToken": "token-1"}
    changes.watch.return_value.execute.return_value = {
        "id": "channel-1",
        "resourceId": "resource-1",
        "expiration": "1779348832000",
    }
    monkeypatch.setenv("GDRIVE_WEBHOOK_TOKEN", "secret")
    monkeypatch.setattr(setup_gdrive_watch, "_get_service", lambda: service)
    monkeypatch.setattr(setup_gdrive_watch, "load_state", lambda: {})
    monkeypatch.setattr(setup_gdrive_watch, "save_state", lambda state: None)
    monkeypatch.setattr(setup_gdrive_watch.uuid, "uuid4", lambda: "channel-1")

    setup_gdrive_watch.register("https://crm.example.com/api/gdrive", "folder-1")

    changes.getStartPageToken.assert_called_once_with(supportsAllDrives=True)
    changes.watch.assert_called_once()
    kwargs = changes.watch.call_args.kwargs
    assert kwargs["supportsAllDrives"] is True
    assert kwargs["includeItemsFromAllDrives"] is True
