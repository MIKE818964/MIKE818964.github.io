"""Tests for check-pilots.mjs - the safety gate that stops a bad nightly scan from replacing the Bounty Board's pilot list.
Runs the real script with node on throwaway files. Run: py -m pytest .github/frontier -q -p no:cacheprovider"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).with_name("check-pilots.mjs")
WORLD = "0x8b8a46ed766fa1358ce7c5c51f6a164b13d627a63e45343f69ed0ba0446c1aa1"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def pilot_list(n: int, *, complete: bool = True, world: str = WORLD, count: int | None = None) -> dict:
    pilots = [{"name": f"Pilot {i}", "itemId": str(2112100000 + i)} for i in range(n)]
    return {"updated": "2026-09-27T09:17:00Z", "world": world, "tenant": "stillness",
            "count": n if count is None else count, "complete": complete, "pilots": pilots}


def run(tmp: Path, fresh: dict, current: dict | None) -> tuple[int, str, str]:
    """Run the gate; returns (exit code, all output, what it wrote to GITHUB_OUTPUT)."""
    (tmp / "fresh.json").write_text(json.dumps(fresh), encoding="utf-8")
    cur = tmp / "current.json"
    if current is not None:
        cur.write_text(json.dumps(current), encoding="utf-8")
    out_file = tmp / "gh_output.txt"
    p = subprocess.run(["node", str(SCRIPT), str(tmp / "fresh.json"), str(cur)], capture_output=True, text=True,
                       env={**__import__("os").environ, "GITHUB_OUTPUT": str(out_file)})
    written = out_file.read_text(encoding="utf-8") if out_file.exists() else ""
    return p.returncode, p.stdout + p.stderr, written


def test_same_list_is_accepted_with_nothing_to_commit(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(19342), pilot_list(19342))
    assert code == 0 and "changed=false" in gh


def test_a_changed_list_is_accepted_and_committed(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(19337), pilot_list(19342))   # 5 fewer: a normal day
    assert code == 0 and "changed=true" in gh


def test_first_run_with_no_current_file(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(19342), None)
    assert code == 0 and "changed=true" in gh


def test_a_garbled_new_file_is_refused_not_crashed(tmp_path: Path) -> None:
    (tmp_path / "fresh.json").write_text("{not json", encoding="utf-8")
    p = subprocess.run(["node", str(SCRIPT), str(tmp_path / "fresh.json"), str(tmp_path / "none.json")],
                       capture_output=True, text=True)
    assert p.returncode == 1 and "REFUSED: could not read the new list" in p.stderr


def test_a_garbled_current_file_is_refused_not_crashed(tmp_path: Path) -> None:
    (tmp_path / "current.json").write_text("<html>not a list</html>", encoding="utf-8")
    (tmp_path / "fresh.json").write_text(json.dumps(pilot_list(19342)), encoding="utf-8")
    p = subprocess.run(["node", str(SCRIPT), str(tmp_path / "fresh.json"), str(tmp_path / "current.json")],
                       capture_output=True, text=True)
    assert p.returncode == 1 and "REFUSED: could not read the current list" in p.stderr


def test_missing_arguments_are_refused(tmp_path: Path) -> None:
    p = subprocess.run(["node", str(SCRIPT)], capture_output=True, text=True)
    assert p.returncode == 1 and "missing arguments" in p.stderr


@pytest.mark.parametrize("fresh, why", [
    (pilot_list(19342, complete=False), "did not finish"),
    (pilot_list(19342, count=19000), "count does not match"),
    (pilot_list(500), "only 500 pilots"),
    (pilot_list(15000), "fell"),                                       # >10% drop vs 19,342
    (pilot_list(19342, world="0x7be1" + "0" * 60), "world changed"),
])
def test_bad_scans_are_refused_and_nothing_is_written(tmp_path: Path, fresh: dict, why: str) -> None:
    code, out, gh = run(tmp_path, fresh, pilot_list(19342))
    assert code == 1, out
    assert "REFUSED" in out and why in out
    assert gh == "", "a refused scan must not tell the workflow to commit"
