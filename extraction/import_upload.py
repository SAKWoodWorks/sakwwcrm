"""Import one uploaded .xlsx file or every .xlsx inside an uploaded .zip.

The script is intentionally small and stdout-only JSON so the Next.js API can
return a per-file result without duplicating extraction logic in TypeScript.
"""
import argparse
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

SUPPORTED_EXTENSIONS = {".xlsx"}


def _run_extract(path: Path) -> dict:
    proc = subprocess.run(
        [sys.executable, "extract_file.py", "--local-path", str(path)],
        cwd=Path(__file__).parent,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    stdout = proc.stdout.strip()
    skipped_existing = proc.returncode == 0 and stdout.startswith("[skip]")
    return {
        "filename": path.name,
        "ok": proc.returncode == 0,
        "status": "skipped_existing" if skipped_existing else ("imported" if proc.returncode == 0 else "failed"),
        "stdout": stdout,
        "stderr": proc.stderr.strip(),
    }


def _zip_leaf_name(filename: str) -> str:
    return filename.replace("\\", "/").rstrip("/").split("/")[-1].strip()


def _safe_extract_xlsx(zip_path: Path, target_dir: Path) -> tuple[list[Path], list[dict]]:
    files: list[Path] = []
    skipped: list[dict] = []
    seen: dict[str, int] = {}
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            leaf_name = _zip_leaf_name(member.filename)
            suffix = Path(leaf_name).suffix.lower()
            if member.is_dir() or not leaf_name:
                continue
            if suffix not in SUPPORTED_EXTENSIONS:
                skipped.append({"filename": member.filename, "reason": "unsupported_type"})
                continue
            count = seen.get(leaf_name, 0)
            seen[leaf_name] = count + 1
            name = Path(leaf_name)
            output_name = leaf_name if count == 0 else f"{name.stem}-{count + 1}{name.suffix}"
            output_path = target_dir / output_name
            with archive.open(member) as src, output_path.open("wb") as dst:
                dst.write(src.read())
            files.append(output_path)
    return files, skipped


def import_path(path: Path) -> dict:
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        results = [_run_extract(path)]
        skipped = []
    elif suffix == ".zip":
        with tempfile.TemporaryDirectory(prefix="crm-import-zip-") as tmp:
            files, skipped = _safe_extract_xlsx(path, Path(tmp))
            results = [_run_extract(file_path) for file_path in files]
    else:
        return {"ok": False, "results": [], "error": "Unsupported file type"}

    return {
        "ok": bool(results) and all(result["ok"] for result in results),
        "results": results,
        "skipped": skipped,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", required=True, help="Uploaded .xlsx or .zip path")
    args = parser.parse_args()

    payload = import_path(Path(args.path))
    print(json.dumps(payload, ensure_ascii=True))
    if not payload.get("ok"):
        sys.exit(1)
