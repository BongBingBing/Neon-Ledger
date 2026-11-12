"""Core loop e2e: boot, new game, a full day, save/reload, offline, layout checks.
Runs on two viewports (iPhone 14 descriptor, 375x667). Console/page errors fail any test (conftest)."""
import json
import time

import pytest

from helpers import (goto, state, screen, wait_screen, new_game, play_day, serve_day, night_routine, click_action,
                     click_ui, has, dismiss_overlays, tap_target_violations, overflow)


def check_layout(page, where):
    o = overflow(page)
    assert o["sw"] <= o["iw"] + 1 and o["bw"] <= o["iw"] + 1, f"{where}: horizontal overflow {o}"
    v = tap_target_violations(page)
    assert not v, f"{where}: tap targets < 44px: {v[:10]}"


def test_boot_title_no_errors_AC_UI_101(page, server):
    t0 = time.time()
    goto(page, server)
    wait_screen(page, "title")
    assert time.time() - t0 < 4, "title screen took too long"
    assert page.evaluate("() => typeof window.__neonLedger === 'object'"), "window.__neonLedger hook missing (ARCH §7)"
    check_layout(page, "title")


def test_new_game_lands_on_dawn_AC_UI_103(page, server):
    goto(page, server)
    s = new_game(page)
    assert s["shopName"] == "E2E Stall"
    assert s["background"] == "sparky" and s["difficulty"] == "acid"
    check_layout(page, "dawn")


def test_full_day_loop_AC_UI_104_110_111(page, server):
    """new game → dawn → open → serve (haggle, deal, refuse) → close → buy stock → sleep → day 2."""
    goto(page, server)
    new_game(page)
    check_layout(page, "dawn")
    click_action(page, "OPEN_SHOP")
    wait_screen(page, "counter")
    s = state(page)
    assert s["phase"] == "open"
    if not s["customer"]:
        click_action(page, "NEXT_CUSTOMER")
    page.wait_for_timeout(100)
    check_layout(page, "counter")
    done = serve_day(page)
    assert done["customers"] >= 1
    assert done["REFUSE"] >= 1, f"no refuse happened: {done}"
    assert done["OFFER"] + done["DEAL"] >= 1, f"no haggle/deal happened: {done}"
    s = state(page)
    if s["phase"] == "open":
        click_action(page, "CLOSE_SHOP")
    wait_screen(page, "night")
    check_layout(page, "night")
    creds = state(page)["creds"]
    inv = len(state(page)["inventory"])
    night_routine(page, buy=True)
    s = state(page)
    for _ in range(30):
        s = state(page)
        if s["phase"] == "dawn" and s["day"] == 2:
            break
        dismiss_overlays(page)
        page.wait_for_timeout(100)
    assert s["day"] == 2 and s["phase"] == "dawn", f"expected dawn day 2, got {s['phase']} day {s['day']}"
    wait_screen(page, "dawn")


def test_save_persists_across_reload_AC_UI_121(page, server):
    goto(page, server)
    new_game(page)
    play_day(page)
    s1 = state(page)
    assert s1["day"] == 2
    page.wait_for_timeout(1200)  # debounced autosave
    page.reload()
    page.wait_for_selector("[data-screen]", state="visible")
    if screen(page) == "title":
        click_ui(page, "continue")
    page.wait_for_function("() => window.__neonLedger && window.__neonLedger.getState() && window.__neonLedger.getState().day === 2", timeout=5000)
    s2 = state(page)
    assert json.dumps(s2, sort_keys=True) == json.dumps(s1, sort_keys=True), "state after reload differs from before"


def test_offline_after_first_load_AC_PWA_104(page, ctx, server):
    goto(page, server)
    page.evaluate("() => navigator.serviceWorker && navigator.serviceWorker.ready")
    # ensure the page is controlled (first load may not be)
    if not page.evaluate("() => !!navigator.serviceWorker.controller"):
        page.reload()
        page.wait_for_function("() => !!navigator.serviceWorker.controller", timeout=8000)
    page.wait_for_timeout(500)
    ctx.set_offline(True)
    try:
        page.reload()
        wait_screen(page, "title")
        new_game(page)
        play_day(page)
        assert state(page)["day"] == 2
    finally:
        ctx.set_offline(False)


def test_no_cross_origin_requests_AC_PWA_106(page, server):
    urls = []
    page.on("request", lambda r: urls.append(r.url))
    goto(page, server)
    new_game(page)
    origin = server.rstrip("/")
    foreign = [u for u in urls if not (u.startswith(origin) or u.startswith("data:") or u.startswith("blob:"))]
    assert not foreign, f"cross-origin requests: {foreign[:5]}"


def test_two_week_playthrough_AC_UI_130(page, server, viewport_name):
    if viewport_name != "iphone14":
        pytest.skip("long playthrough runs on iPhone 14 only")
    page.set_default_timeout(10000)
    goto(page, server)
    new_game(page, background="sparky", difficulty="drizzle")
    for d in range(14):
        s = state(page)
        if s["phase"] == "ended":
            break
        play_day(page, buy=(d % 2 == 0))
        if d in (0, 6, 13):
            check_layout(page, f"dawn day {state(page)['day']}")
    s = state(page)
    assert s["day"] >= 14 or s["phase"] == "ended", f"stopped at day {s['day']} phase {s['phase']}"
