"""Shared fixtures for Neon Ledger e2e tests (pytest + Playwright Chromium).

- `server`: serves the repo root on a free port for the whole session.
- `browser`: one Chromium instance per session (WebKit is unavailable on this host).
- `ctx` / `page`: parametrized over two viewports: iPhone 14 (device descriptor) and 375x667 (SE).
  Every console error / page error / failed same-origin request fails the test at teardown.
- On failure a screenshot is saved to tests/reports/screenshots/<test>.png.

UI hooks used (requested from UI dev via the Overseer):
  [data-screen=<name>] on screen roots, [data-action=<ENGINE_ACTION>] on dispatching buttons,
  [data-ui=<name>] on non-engine controls, window.__neonLedger.getState() read-only debug hook.
Text/role fallbacks are used where reasonable.
"""
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "tests" / "reports" / "screenshots"

if not (ROOT / "index.html").exists():
    pytest.skip("index.html not present yet", allow_module_level=True)


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def server():
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}/"
    for _ in range(100):
        try:
            urllib.request.urlopen(url, timeout=0.5)
            break
        except Exception:
            time.sleep(0.1)
    else:
        proc.kill()
        raise RuntimeError("dev server did not start")
    yield url
    proc.terminate()
    proc.wait(5)


@pytest.fixture(scope="session")
def pw():
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope="session")
def browser(pw):
    b = pw.chromium.launch()
    yield b
    b.close()


def _iphone14(pw):
    d = dict(pw.devices["iPhone 14"])
    d.pop("default_browser_type", None)
    return d


VIEWPORTS = ["iphone14", "se"]


def context_options(pw, name):
    if name == "iphone14":
        return _iphone14(pw)
    base = _iphone14(pw)
    base.update(viewport={"width": 375, "height": 667}, screen={"width": 375, "height": 667}, device_scale_factor=2)
    return base


class ErrorLog:
    def __init__(self, origin):
        self.origin = origin
        self.errors = []

    def attach(self, page):
        page.on("console", lambda m: m.type == "error" and self.errors.append(f"console.error: {m.text}"))
        page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: r.url.startswith(self.origin) and not self._expected_fail(r)
                and self.errors.append(f"requestfailed: {r.url} {r.failure}"))
        page.on("response", lambda r: r.url.startswith(self.origin) and r.status >= 400
                and self.errors.append(f"HTTP {r.status}: {r.url}"))

    @staticmethod
    def _expected_fail(r):
        # aborted navigations during reload are fine
        return "ERR_ABORTED" in (r.failure or "") or "ERR_INTERNET_DISCONNECTED" in (r.failure or "")


@pytest.fixture(params=VIEWPORTS)
def viewport_name(request):
    return request.param


@pytest.fixture
def ctx(browser, pw, viewport_name, server):
    c = browser.new_context(**context_options(pw, viewport_name), service_workers="allow")
    c.errlog = ErrorLog(server.rstrip("/"))
    yield c
    c.close()


@pytest.fixture
def page(ctx, request):
    p = ctx.new_page()
    ctx.errlog.attach(p)
    p.set_default_timeout(8000)
    yield p
    rep = getattr(request.node, "rep_call", None)
    if rep is not None and rep.failed:
        SHOTS.mkdir(parents=True, exist_ok=True)
        name = re.sub(r"[^\w.-]+", "_", request.node.nodeid.split("::", 1)[-1])
        try:
            p.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)
        except Exception:
            pass
    errs = ctx.errlog.errors
    if rep is not None and rep.passed and errs:
        pytest.fail("console/page errors:\n" + "\n".join(errs[:20]))


@pytest.hookimpl(hookwrapper=True, tryfirst=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)
