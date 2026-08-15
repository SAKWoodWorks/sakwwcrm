import gdrive_client


class _Execute:
    def __init__(self, result):
        self.result = result

    def execute(self):
        return self.result


class _Files:
    def __init__(self):
        self.list_kwargs = None

    def list(self, **kwargs):
        self.list_kwargs = kwargs
        return _Execute({"files": [], "nextPageToken": None})


class _Service:
    def __init__(self):
        self.files_resource = _Files()

    def files(self):
        return self.files_resource


def test_list_files_in_folder_includes_shared_drive_files(monkeypatch):
    service = _Service()
    monkeypatch.setattr(gdrive_client, "_get_service", lambda: service)

    assert list(gdrive_client.list_files_in_folder("folder-123")) == []

    assert service.files_resource.list_kwargs["supportsAllDrives"] is True
    assert service.files_resource.list_kwargs["includeItemsFromAllDrives"] is True
