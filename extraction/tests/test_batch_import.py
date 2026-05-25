from pathlib import Path

from batch_import import get_salesperson_override


def test_local_folder_month_subfolder_does_not_override_filename_salesperson():
    root = Path("imports")
    filepath = root / "04-APR" / "I_B No 033KL 29-04-2026 KLWI Wanida_PAID_ (--) KLPU.xlsx"

    assert get_salesperson_override(filepath, root) is None


def test_local_folder_named_salesperson_can_override_filename_salesperson():
    root = Path("imports")
    filepath = root / "Pickachu" / "TI_B No 001 01-05-2026 Web Jane(-PAID-)(--) ACME PTPU.xlsx"

    assert get_salesperson_override(filepath, root) == "Pickachu"
