"""Tests for check-pilots.mjs - the safety gate that stops a bad nightly scan from replacing the Bounty Board's pilot list.
Runs the real script with node on throwaway files. Run: py -m pytest .github/frontier -q -p no:cacheprovider"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).with_name("check-pilots.mjs")
WORLD = "0x8b8a46ed766fa1358ce7c5c51f6a164b13d627a63e45343f69ed0ba0446c1aa1"          # Cycle 6 Stillness world
NEW_WORLD = "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92"      # Cycle 7 (fresh, 2026-09-29)

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def pilot_list(n: int, *, complete: bool = True, world: str = WORLD, count: int | None = None) -> dict:
    pilots = [{"name": f"Pilot {i}", "itemId": str(2112100000 + i)} for i in range(n)]
    return {"updated": "2026-09-27T09:17:00Z", "world": world, "tenant": "stillness",
            "count": n if count is None else count, "complete": complete, "pilots": pilots}


def run(tmp: Path, fresh: dict, current: dict | None, world_file: dict | str | None = None) -> tuple[int, str, str]:
    """Run the gate; returns (exit code, all output, what it wrote to GITHUB_OUTPUT).
    world_file: the site's world.json (a dict, or raw text for a garbled file); None = old two-argument call."""
    (tmp / "fresh.json").write_text(json.dumps(fresh), encoding="utf-8")
    cur = tmp / "current.json"
    if current is not None:
        cur.write_text(json.dumps(current), encoding="utf-8")
    args = ["node", str(SCRIPT), str(tmp / "fresh.json"), str(cur)]
    if world_file is not None:
        wf = tmp / "world.json"
        wf.write_text(world_file if isinstance(world_file, str) else json.dumps(world_file), encoding="utf-8")
        args.append(str(wf))
    out_file = tmp / "gh_output.txt"
    p = subprocess.run(args, capture_output=True, text=True,
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


# ---- world.json: the site repo names the world the directory must come from (Cycle 7 switch, 2026-09-29) ----
# A world change is a human decision: it is accepted only when world.json names the new world. A fresh world starts
# with zero pilots, so world.json also sets the minimum (minPilots) instead of the fixed 1,000.

def test_same_world_behaves_exactly_as_before(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(19337), pilot_list(19342), {"world": WORLD, "minPilots": 1000})
    assert code == 0 and "changed=true" in gh


def test_a_world_change_nobody_named_is_still_refused(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(40, world=NEW_WORLD), pilot_list(19342),
                        {"world": WORLD, "minPilots": 1000})
    assert code == 1 and "REFUSED" in out and gh == ""


def test_a_named_world_switch_replaces_the_old_worlds_list(tmp_path: Path) -> None:
    # Day one of a fresh world: 3 pilots replace 19,342 from the old world (no 10% drop check across worlds).
    code, out, gh = run(tmp_path, pilot_list(3, world=NEW_WORLD), pilot_list(19342),
                        {"world": NEW_WORLD, "minPilots": 1})
    assert code == 0 and "changed=true" in gh, out
    assert "world switch" in out.lower()


def test_a_scan_of_the_wrong_world_is_refused(tmp_path: Path) -> None:
    # world.json says Cycle 7 but the job scanned Cycle 6 (a stale setting): never publish it.
    code, out, gh = run(tmp_path, pilot_list(19342), pilot_list(19342), {"world": NEW_WORLD, "minPilots": 1})
    assert code == 1 and "REFUSED" in out and gh == ""


def test_world_addresses_match_however_they_are_written(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(5, world=NEW_WORLD.upper().replace("0X", "0x")), pilot_list(19342),
                        {"world": NEW_WORLD, "minPilots": 1})
    assert code == 0 and "changed=true" in gh, out


def test_the_drop_check_still_guards_the_new_world(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(40, world=NEW_WORLD), pilot_list(50, world=NEW_WORLD),
                        {"world": NEW_WORLD, "minPilots": 1})
    assert code == 1 and "fell" in out and gh == ""


def test_an_empty_scan_is_refused_even_for_a_fresh_world(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(0, world=NEW_WORLD), pilot_list(19342),
                        {"world": NEW_WORLD, "minPilots": 1})
    assert code == 1 and "only 0 pilots" in out and gh == ""


def test_min_pilots_comes_from_world_json(tmp_path: Path) -> None:
    code, out, gh = run(tmp_path, pilot_list(1500), pilot_list(1500), {"world": WORLD, "minPilots": 2000})
    assert code == 1 and "only 1500 pilots" in out


@pytest.mark.parametrize("world_file, why", [
    ("{not json", "could not read the world"),
    ({"minPilots": 1}, "world.json must name the world"),
    ({"world": "0x7be1", "minPilots": 1}, "world.json must name the world"),
    ({"world": NEW_WORLD, "minPilots": 0}, "minPilots"),
    ({"world": NEW_WORLD, "minPilots": "ten"}, "minPilots"),
    ({"world": NEW_WORLD, "minPilots": 2.5}, "minPilots"),
])
def test_a_bad_world_json_is_refused_not_crashed(tmp_path: Path, world_file, why: str) -> None:
    code, out, gh = run(tmp_path, pilot_list(5, world=NEW_WORLD), pilot_list(19342), world_file)
    assert code == 1 and "REFUSED" in out and why in out and gh == "", out
