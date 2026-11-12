"""Page helpers for Neon Ledger e2e tests. Uses the binding test hooks in ARCHITECTURE §7."""
import json
import time

from playwright.sync_api import Page, expect

SCREENS = ["title", "newgame", "dawn", "counter", "night", "summary", "ledger", "settings", "ending"]


def goto(page: Page, url: str):
    page.goto(url)
    page.wait_for_selector("[data-screen]", state="visible", timeout=5000)


def state(page: Page):
    return page.evaluate("() => window.__neonLedger && window.__neonLedger.getState ? window.__neonLedger.getState() : null")


def screen(page: Page):
    return page.evaluate(
        """() => { const els = [...document.querySelectorAll('[data-screen]')]
              .filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
                             return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; });
              return els.length ? els[els.length - 1].dataset.screen : null; }"""
    )


def wait_screen(page: Page, name: str, timeout=5000):
    page.wait_for_function(
        """(n) => [...document.querySelectorAll(`[data-screen="${n}"]`)].some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })""",
        arg=name, timeout=timeout)


def _enabled(page: Page, sel: str):
    loc = page.locator(f"{sel}:not([disabled]):not([aria-disabled=true])")
    n = loc.count()
    for i in range(n):
        el = loc.nth(i)
        if el.is_visible():
            return el
    return None


def has(page: Page, action: str) -> bool:
    return _enabled(page, f'[data-action="{action}"]') is not None


def click_action(page: Page, action: str, **match):
    sel = f'[data-action="{action}"]' + "".join(f'[data-{k}="{v}"]' for k, v in match.items())
    el = _enabled(page, sel)
    assert el is not None, f"no enabled visible button for {action} on screen {screen(page)}"
    el.click()
    page.wait_for_timeout(60)


def click_ui(page: Page, name: str, required=True):
    el = _enabled(page, f'[data-ui="{name}"]')
    if el is None:
        assert not required, f'no visible [data-ui="{name}"] on screen {screen(page)}'
        return False
    el.click()
    page.wait_for_timeout(60)
    return True


def dismiss_overlays(page: Page):
    """Close summary cards / onboarding hints / toasts that block the flow."""
    for name in ["summary-continue", "hint-dismiss", "dismiss", "close"]:
        click_ui(page, name, required=False)


def new_game(page: Page, background="sparky", difficulty="acid", shop_name="E2E Stall"):
    wait_screen(page, "title")
    if not (click_ui(page, "new-game", required=False) or click_ui(page, "newgame", required=False)):
        page.get_by_role("button", name="New Game").first.click()
    wait_screen(page, "newgame")
    name = page.locator('[data-ui="shop-name"]')
    if name.count():
        name.first.fill(shop_name)
    click_ui(page, f"bg-{background}", required=False)
    click_ui(page, f"diff-{difficulty}", required=False)
    click_ui(page, "start")
    wait_screen(page, "dawn")
    s = state(page)
    assert s and s["day"] == 1 and s["phase"] == "dawn"
    return s


def serve_day(page: Page, max_steps=150):
    """At the counter: serve every customer. Returns counts of what was done."""
    done = {"OFFER": 0, "DEAL": 0, "REFUSE": 0, "SELECT_ITEM": 0, "ACCEPT_CHIT": 0, "REJECT_CHIT": 0, "customers": 0}
    refuse_next_seller = True
    for _ in range(max_steps):
        dismiss_overlays(page)
        s = state(page)
        if s["phase"] != "open":
            break
        c = s.get("customer")
        if not c:
            if has(page, "NEXT_CUSTOMER") and s["queue"]:
                click_action(page, "NEXT_CUSTOMER")
                done["customers"] += 1
            else:
                click_action(page, "CLOSE_SHOP")
            continue
        if has(page, "ACCEPT_CHIT"):
            ch = c.get("chit") or {}
            tells = (ch.get("name") != c.get("name")) + (ch.get("ward") != c.get("homeWard")) + bool(ch.get("sigilGlitch")) + (ch.get("expiryDay", 999) < s["day"])
            a = "REJECT_CHIT" if tells else "ACCEPT_CHIT"
            click_action(page, a)
            done[a] += 1
            continue
        if c["kind"] == "buyer":
            if not c.get("selectedUid"):
                if has(page, "SELECT_ITEM"):
                    click_action(page, "SELECT_ITEM")
                    done["SELECT_ITEM"] += 1
                else:
                    click_action(page, "REFUSE")
                    done["REFUSE"] += 1
                continue
            if not has(page, "OFFER"):
                click_ui(page, "haggle", required=False)
            if has(page, "OFFER"):
                click_action(page, "OFFER")
                done["OFFER"] += 1
                page.wait_for_timeout(50)
                if has(page, "DEAL"):
                    click_action(page, "DEAL")
                    done["DEAL"] += 1
                continue
            if has(page, "DEAL"):
                click_action(page, "DEAL")
                done["DEAL"] += 1
                continue
            click_action(page, "REFUSE")
            done["REFUSE"] += 1
            continue
        # sellers / specials
        if c["kind"] == "special" and has(page, "SPECIAL_CHOICE"):
            click_action(page, "SPECIAL_CHOICE")
            continue
        if refuse_next_seller or not has(page, "DEAL"):
            click_action(page, "REFUSE")
            done["REFUSE"] += 1
            refuse_next_seller = False
        else:
            click_action(page, "DEAL")
            done["DEAL"] += 1
            refuse_next_seller = True
            s2 = state(page)
            if s2.get("customer") and s2["customer"]["id"] == c["id"]:
                click_action(page, "REFUSE")
    return done


def night_routine(page: Page, buy=True):
    dismiss_overlays(page)
    s = state(page)
    assert s["phase"] == "night"
    if has(page, "PAY_DUES") and s["creds"] > 100:
        click_action(page, "PAY_DUES")
    if buy:
        click_ui(page, "tab-market", required=False)
        if has(page, "BUY_STOCK"):
            before = state(page)["creds"]
            click_action(page, "BUY_STOCK")
            dismiss_overlays(page)
            # a quantity sheet may need confirming
            if state(page)["creds"] == before and has(page, "BUY_STOCK"):
                click_action(page, "BUY_STOCK")
    dismiss_overlays(page)
    click_action(page, "SLEEP")


def play_day(page: Page, buy=True):
    """dawn → open → serve → close → night → sleep → next dawn."""
    s = state(page)
    day = s["day"]
    dismiss_overlays(page)
    if s.get("audit"):
        click_action(page, "AUDIT_RESPOND", choice="comply") if _enabled(page, '[data-action="AUDIT_RESPOND"][data-choice="comply"]') else click_action(page, "AUDIT_RESPOND")
    click_action(page, "OPEN_SHOP")
    wait_screen(page, "counter")
    done = serve_day(page)
    s = state(page)
    if s["phase"] == "open":
        click_action(page, "CLOSE_SHOP")
    s = state(page)
    if s["phase"] == "night":
        night_routine(page, buy=buy)
    # summary card then dawn
    for _ in range(20):
        s = state(page)
        if s["phase"] in ("dawn", "ended") and s["day"] != day or s["phase"] == "ended":
            break
        dismiss_overlays(page)
        page.wait_for_timeout(100)
    dismiss_overlays(page)
    return done


def tap_target_violations(page: Page, min_px=44):
    return page.evaluate(
        """(min) => {
          const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [data-action], [data-ui]';
          const out = [];
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
            if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
            if (el.closest('[aria-hidden=true]')) continue;
            if (el.tagName === 'INPUT' && el.type === 'text' && r.height >= min) continue;
            if (r.width + 0.5 < min || r.height + 0.5 < min) {
              out.push(`${el.tagName.toLowerCase()}${el.dataset.action ? '[data-action=' + el.dataset.action + ']' : ''}${el.dataset.ui ? '[data-ui=' + el.dataset.ui + ']' : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
          }
          return out;
        }""", min_px)


def overflow(page: Page):
    return page.evaluate(
        """() => ({ sw: document.documentElement.scrollWidth, bw: document.body ? document.body.scrollWidth : 0, iw: window.innerWidth })""")
