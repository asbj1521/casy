#!/usr/bin/env python3
"""The app's UI tests on several simulators at once (scripts/native/ui-tests.sh calls it).

The whole suite one test after another took about 35 minutes on an M2 Pro; nearly all
of it is each test starting the app afresh. Here the test classes are dealt out over
`workers` simulators by how long each usually takes (the middle of its last three runs,
kept in ~/Library/Caches/casy-ui-test-times.json), each simulator with its own fake backend
(port 4318 + n, handed to its runner as CASY_BACKEND), the app built once. The
person's own simulator (iPhone 17) is shut down for the run and started again after,
to leave its memory to the test simulators.

Now and then the app never tells the test runner its animations are done, and XCTest
then waits 60 s before every step: one test once took 17 minutes, and still passed.
A watch on each runner's log closes the app when that happens twice in one test, so the
test fails at once; every failed test is then run once more, alone, and one that passes
the second time is reported as flaky rather than failed. Before a merge, UI_TESTS_STRICT=1
runs nothing twice: any failure fails the run, as one after another always did.

The app is built first and the simulators are then started one at a time, each fully up
before the next: right after a restart, four cold starts at once on top of the build
took the Mac's load past 900 and filled its swap (21 Nov 2026). A guard stops the whole
run, simulators and all, if the Mac still chokes (memory critical, or frozen).

On an M2 Pro with 16 GB: about 50 min one after another, 19 min on 2, 10 min on 4.

  scripts/native/ui-tests.sh                       # every class, UI_TEST_WORKERS simulators (default 4)
  UI_TESTS_STRICT=1 scripts/native/ui-tests.sh    # before a merge: no second tries
  UI_TEST_WORKERS=1 scripts/native/ui-tests.sh     # one after another, as before
"""
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
TESTS = ROOT / "ios/App/AppUITests"
TIMES = Path.home() / "Library/Caches/casy-ui-test-times.json"
BASE = "iPhone 17e"
PERSONAL = "iPhone 17"
FIRST_PORT = 4318
APP_ID = "app.casy"
STALL = "App animations complete notification not received"
STARTED = re.compile(r"Test Case '-\[AppUITests\.(\w+) (\w+)\]' started")
CASE = re.compile(r"Test Case '-\[AppUITests\.(\w+) (\w+)\]' (passed|failed) \(([\d.]+) seconds\)")


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


def recorded():
    """Each class's last few times (an older file kept one number)."""
    try:
        raw = json.loads(TIMES.read_text())
    except (OSError, ValueError):
        return {}
    return {k: v if isinstance(v, list) else [v] for k, v in raw.items()}


def typical(runs):
    return sorted(runs)[len(runs) // 2]


def deal(names, workers):
    """The longest first, each to the simulator with the least so far."""
    times = {k: typical(v) for k, v in recorded().items()}
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


def watch(path, udid, proc, stalls):
    """Closes the app when a test has waited out XCTest's idle check twice."""
    current, seen, pos = None, 0, 0
    while proc.poll() is None:
        time.sleep(5)
        try:
            with open(path, errors="replace") as f:
                f.seek(pos)
                chunk = f.read()
                pos = f.tell()
        except OSError:
            continue
        for line in chunk.splitlines():
            m = STARTED.search(line)
            if m:
                current, seen = f"{m.group(1)}.{m.group(2)}", 0
            elif STALL in line and current:
                seen += 1
                if seen == 2:
                    stalls.append(current)
                    subprocess.run(["xcrun", "simctl", "terminate", udid, APP_ID], capture_output=True)


def grant_calendars(udid):
    """The phone's calendars allowed for the app, as after someone said yes: the app's own
    labels test (#282) fills one, and iOS's question can't be relied on in a test."""
    subprocess.run(["xcrun", "simctl", "privacy", udid, "grant", "calendar", APP_ID], capture_output=True)


def guard(runners, choked):
    """Stops the run when the Mac chokes: macOS calls memory critical three readings running,
    or the guard's own 15 s check comes back over a minute late (the Mac froze). Not the
    load average: on macOS 27 it stayed in the hundreds with the CPU 90 % idle."""
    critical, last = 0, time.time()
    while True:
        time.sleep(15)
        level = int(run("sysctl", "-n", "kern.memorystatus_vm_pressure_level"))
        # The whole gap since the last reading, the reading itself included.
        late, last = time.time() - last - 15, time.time()
        critical = critical + 1 if level >= 4 else 0
        why = "memory critical" if critical == 3 else f"froze for {late:.0f} s" if late > 60 else None
        if why:
            choked.append(why)
            print(f"ui-tests: the Mac is choking ({why}): stopping the run", flush=True)
            for p, _ in runners:
                p.terminate()
            os.kill(os.getpid(), signal.SIGTERM)
            return


def xctest(udid, port, only, result, log):
    env = dict(os.environ, TEST_RUNNER_CASY_BACKEND=f"http://localhost:{port}",
               TEST_RUNNER_CASY_SHOTS=os.environ.get("CASY_SHOTS_DIR", ""))
    args = ["xcodebuild", "test-without-building", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
            "-configuration", "Debug", "-destination", f"platform=iOS Simulator,id={udid}",
            "-parallel-testing-enabled", "NO", "CODE_SIGNING_ALLOWED=NO", "-resultBundlePath", str(result)]
    args += [f"-only-testing:AppUITests/{t}" for t in only]
    return subprocess.Popen(args, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)


def main():
    workers = max(1, int(os.environ.get("UI_TEST_WORKERS", "4")))
    work = Path(tempfile.mkdtemp(prefix="casy-ui-tests-"))
    groups = deal(classes(), workers)
    sims = simulators(len(groups))

    _, personal = find(PERSONAL)
    personal_was_on = bool(personal) and personal["state"] == "Booted"
    if personal_was_on:
        print(f"ui-tests: shutting down {PERSONAL} for the run")
        subprocess.run(["xcrun", "simctl", "shutdown", personal["udid"]], capture_output=True)

    servers, runners, stalls, retried, choked = [], [], [], {}, []
    started = time.time()
    # Stopped from outside (or by the guard), the finally below still tidies up.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    threading.Thread(target=guard, args=(runners, choked), daemon=True).start()
    try:
        bundle = work / "fake-backend.mjs"
        run("npx", "esbuild", "scripts/native/fake-backend.ts", "--bundle", "--platform=node", "--format=esm",
            f"--outfile={bundle}", "--log-level=warning", cwd=ROOT)
        for i in range(len(groups)):
            env = dict(os.environ, PORT=str(FIRST_PORT + i), SLOW_ACTIONS="push-set")
            servers.append(subprocess.Popen(["node", str(bundle)], env=env, stdout=subprocess.DEVNULL,
                                            stderr=subprocess.DEVNULL))
        print("ui-tests: building once")
        subprocess.run(["xcodebuild", "build-for-testing", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
                        "-configuration", "Debug", "-destination", f"platform=iOS Simulator,id={sims[0]}",
                        "CODE_SIGNING_ALLOWED=NO", "-quiet"], cwd=ROOT, check=True)

        # One at a time, each fully started (bootstatus -b boots and waits) before the next.
        for n, udid in enumerate(sims):
            if not booted(udid):
                print(f"ui-tests: starting simulator {n + 1}")
                subprocess.run(["xcrun", "simctl", "bootstatus", udid, "-b"], capture_output=True)
            grant_calendars(udid)

        for i, (group, udid) in enumerate(zip(groups, sims)):
            path = work / f"worker{i + 1}.log"
            log = open(path, "w")
            print(f"ui-tests: simulator {i + 1}: {', '.join(group)}")
            p = xctest(udid, FIRST_PORT + i, group, work / f"worker{i + 1}.xcresult", log)
            threading.Thread(target=watch, args=(path, udid, p, stalls), daemon=True).start()
            runners.append((p, log))
        for p, log in runners:
            p.wait()
            log.close()

        # Each failed test once more, alone on the first simulator.
        first_failed = [f"{c}.{t}" for i in range(len(groups))
                        for c, t, o, _ in CASE.findall((work / f"worker{i + 1}.log").read_text(errors="replace"))
                        if o == "failed"]
        strict = os.environ.get("UI_TESTS_STRICT") == "1"
        if strict and first_failed:
            print("ui-tests: strict (UI_TESTS_STRICT=1): no second tries")
        for n, name in enumerate([] if strict else first_failed):
            print(f"ui-tests: {name} failed; running it once more")
            path = work / f"retry{n + 1}.log"
            with open(path, "w") as log:
                xctest(sims[0], FIRST_PORT, [name.replace(".", "/")], work / f"retry{n + 1}.xcresult", log).wait()
            outcomes = [o for _, _, o, _ in CASE.findall(path.read_text(errors="replace"))]
            retried[name] = bool(outcomes) and all(o == "passed" for o in outcomes)
    finally:
        for s in servers:
            s.terminate()
        stopped = sys.exc_info()[0] is not None
        for p, _ in runners:
            if p.poll() is None:
                p.terminate()
        if stopped:
            print("ui-tests: stopped; shutting the test simulators down")
            for udid in sims:
                subprocess.run(["xcrun", "simctl", "shutdown", udid], capture_output=True)
        if personal_was_on:
            print(f"ui-tests: starting {PERSONAL} again")
            subprocess.run(["xcrun", "simctl", "boot", personal["udid"]], capture_output=True)

    # The results, and each class's time for dealing out the next run.
    passed, failed, flaky, took = 0, [], [], {}
    for i in range(len(groups)):
        text = (work / f"worker{i + 1}.log").read_text(errors="replace")
        for cls, test, outcome, seconds in CASE.findall(text):
            took[cls] = took.get(cls, 0) + float(seconds)
            name = f"{cls}.{test}"
            if outcome == "passed":
                passed += 1
            elif retried.get(name):
                passed += 1
                flaky.append(name)
            else:
                failed.append(name)
        for line in text.splitlines():
            if ": error: " in line and "AppUITests" in line:
                print("ui-tests:   " + line.split("AppUITests/")[-1])
    times = recorded()
    for cls, seconds in took.items():
        times[cls] = (times.get(cls, []) + [round(seconds, 1)])[-3:]
    TIMES.write_text(json.dumps(times, indent=1))

    minutes = (time.time() - started) / 60
    print(f"ui-tests: {passed} passed, {len(failed)} failed, on {len(groups)} simulators in {minutes:.1f} min")
    for f in failed:
        print(f"ui-tests:   failed: {f}")
    for f in flaky:
        print(f"ui-tests:   flaky (failed, then passed alone): {f}")
    for s in sorted(set(stalls)):
        print(f"ui-tests:   stalled (the app never went idle; closed it): {s}")
    bad = [i + 1 for i, (p, _) in enumerate(runners) if p.returncode != 0]
    crashed = bad and not failed and not flaky
    if crashed:
        print(f"ui-tests: simulator {bad} ended badly; its log: {work}/worker{bad[0]}.log")
    print(f"ui-tests: logs and results in {work}")
    sys.exit(1 if failed or crashed else 0)


if __name__ == "__main__":
    main()
