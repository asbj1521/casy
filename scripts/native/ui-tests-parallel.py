#!/usr/bin/env python3
"""The app's UI tests on several simulators at once (scripts/native/ui-tests.sh calls it).

The whole suite one test after another took about 35 minutes on an M2 Pro; nearly all
of it is each test starting the app afresh. Here the test classes are dealt out over
`workers` simulators by how long each took last time (kept in
~/Library/Caches/casy-ui-test-times.json), each simulator with its own fake backend
(port 4318 + n, handed to its runner as CASY_BACKEND), the app built once. The
person's own simulator (iPhone 17) is shut down for the run and started again after,
to leave its memory to the test simulators.

  scripts/native/ui-tests.sh                       # every class, UI_TEST_WORKERS simulators (default 3)
  UI_TEST_WORKERS=1 scripts/native/ui-tests.sh     # one after another, as before
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
TESTS = ROOT / "ios/App/AppUITests"
TIMES = Path.home() / "Library/Caches/casy-ui-test-times.json"
BASE = "iPhone 17e"
PERSONAL = "iPhone 17"
FIRST_PORT = 4318


def run(*args, **kw):
    return subprocess.run(list(args), check=True, text=True, capture_output=True, **kw).stdout


def devices():
    return json.loads(run("xcrun", "simctl", "list", "devices", "available", "-j"))["devices"]


def find(name):
    for runtime, list_ in devices().items():
        for d in list_:
            if d["name"] == name:
                return runtime, d
    return None, None


def simulators(count):
    """The test simulators: iPhone 17e, then "Casy Test 2"… made once like it."""
    runtime, base = find(BASE)
    if not base:
        sys.exit(f"ui-tests: no {BASE} simulator")
    found = [base["udid"]]
    for n in range(2, count + 1):
        name = f"Casy Test {n}"
        _, d = find(name)
        if not d:
            print(f"ui-tests: making the simulator {name} (once)")
            udid = run("xcrun", "simctl", "create", name, base["deviceTypeIdentifier"], runtime).strip()
        else:
            udid = d["udid"]
        found.append(udid)
    return found


def classes():
    names = []
    for f in sorted(TESTS.glob("*UITests.swift")):
        for m in re.finditer(r"final class (\w+UITests)\s*:\s*XCTestCase", f.read_text()):
            if m.group(1) != "ParityUITests":
                names.append(m.group(1))
    return names


def deal(names, workers):
    """The longest first, each to the simulator with the least so far."""
    try:
        times = json.loads(TIMES.read_text())
    except (OSError, ValueError):
        times = {}
    known = [times[n] for n in names if n in times]
    guess = sum(known) / len(known) if known else 60
    loads = [[0.0, []] for _ in range(workers)]
    for n in sorted(names, key=lambda n: -times.get(n, guess)):
        least = min(loads, key=lambda l: l[0])
        least[0] += times.get(n, guess)
        least[1].append(n)
    return [l[1] for l in loads if l[1]]


def booted(udid):
    for list_ in devices().values():
        for d in list_:
            if d["udid"] == udid:
                return d["state"] == "Booted"
    return False


def main():
    workers = max(1, int(os.environ.get("UI_TEST_WORKERS", "3")))
    work = Path(tempfile.mkdtemp(prefix="casy-ui-tests-"))
    groups = deal(classes(), workers)
    sims = simulators(len(groups))

    _, personal = find(PERSONAL)
    personal_was_on = bool(personal) and personal["state"] == "Booted"
    if personal_was_on:
        print(f"ui-tests: shutting down {PERSONAL} for the run")
        subprocess.run(["xcrun", "simctl", "shutdown", personal["udid"]], capture_output=True)

    servers, runners = [], []
    started = time.time()
    try:
        bundle = work / "fake-backend.mjs"
        run("npx", "esbuild", "scripts/native/fake-backend.ts", "--bundle", "--platform=node", "--format=esm",
            f"--outfile={bundle}", "--log-level=warning", cwd=ROOT)
        for i in range(len(groups)):
            env = dict(os.environ, PORT=str(FIRST_PORT + i), SLOW_ACTIONS="push-set")
            servers.append(subprocess.Popen(["node", str(bundle)], env=env, stdout=subprocess.DEVNULL,
                                            stderr=subprocess.DEVNULL))
        for udid in sims:
            if not booted(udid):
                subprocess.run(["xcrun", "simctl", "boot", udid], capture_output=True)

        print("ui-tests: building once")
        subprocess.run(["xcodebuild", "build-for-testing", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
                        "-configuration", "Debug", "-destination", f"platform=iOS Simulator,id={sims[0]}",
                        "CODE_SIGNING_ALLOWED=NO", "-quiet"], cwd=ROOT, check=True)

        for i, (group, udid) in enumerate(zip(groups, sims)):
            log = open(work / f"worker{i + 1}.log", "w")
            env = dict(os.environ, TEST_RUNNER_CASY_BACKEND=f"http://localhost:{FIRST_PORT + i}",
                       TEST_RUNNER_CASY_SHOTS=os.environ.get("CASY_SHOTS_DIR", ""))
            args = ["xcodebuild", "test-without-building", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
                    "-configuration", "Debug", "-destination", f"platform=iOS Simulator,id={udid}",
                    "-parallel-testing-enabled", "NO", "CODE_SIGNING_ALLOWED=NO",
                    "-resultBundlePath", str(work / f"worker{i + 1}.xcresult")]
            args += [f"-only-testing:AppUITests/{c}" for c in group]
            print(f"ui-tests: simulator {i + 1}: {', '.join(group)}")
            runners.append((subprocess.Popen(args, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT), log))
        for p, log in runners:
            p.wait()
            log.close()
    finally:
        for s in servers:
            s.terminate()
        if personal_was_on:
            print(f"ui-tests: starting {PERSONAL} again")
            subprocess.run(["xcrun", "simctl", "boot", personal["udid"]], capture_output=True)

    # The results, and each class's time for dealing out the next run.
    case = re.compile(r"Test Case '-\[AppUITests\.(\w+) (\w+)\]' (passed|failed) \(([\d.]+) seconds\)")
    passed, failed, took = 0, [], {}
    for i in range(len(groups)):
        text = (work / f"worker{i + 1}.log").read_text(errors="replace")
        for cls, test, outcome, seconds in case.findall(text):
            took[cls] = took.get(cls, 0) + float(seconds)
            if outcome == "passed":
                passed += 1
            else:
                failed.append(f"{cls}.{test}")
        for line in text.splitlines():
            if ": error: " in line and "AppUITests" in line:
                print("ui-tests:   " + line.split("AppUITests/")[-1])
    try:
        old = json.loads(TIMES.read_text())
    except (OSError, ValueError):
        old = {}
    TIMES.write_text(json.dumps({**old, **took}, indent=1))

    minutes = (time.time() - started) / 60
    print(f"ui-tests: {passed} passed, {len(failed)} failed, on {len(groups)} simulators in {minutes:.1f} min")
    for f in failed:
        print(f"ui-tests:   failed: {f}")
    bad = [i + 1 for i, (p, _) in enumerate(runners) if p.returncode != 0]
    if bad and not failed:
        print(f"ui-tests: simulator {bad} ended badly; its log: {work}/worker{bad[0]}.log")
    print(f"ui-tests: logs and results in {work}")
    sys.exit(1 if failed or bad else 0)


if __name__ == "__main__":
    main()
