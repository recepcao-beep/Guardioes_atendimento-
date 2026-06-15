from __future__ import annotations

import argparse
import datetime as dt
import os
import pathlib
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

import requests
from dotenv import load_dotenv
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


DEFAULT_XPATHS = {
    "XPATH_USER_INPUT": "/html/body/app-root/ng-component/div/div[1]/div/div[1]/section/div[1]/div/div/ng-component/form/div[1]/input",
    "XPATH_PASS_INPUT": "/html/body/app-root/ng-component/div/div[1]/div/div[1]/section/div[1]/div/div/ng-component/form/div[2]/input",
    "XPATH_LOGIN_BTN": "/html/body/app-root/ng-component/div/div[1]/div/div[1]/section/div[1]/div/div/ng-component/form/div[4]/div/button",
    "XPATH_ONLINE_BTN": "/html/body/app-root/ng-component/div/mat-drawer-container/mat-drawer-content/mat-sidenav-container/mat-sidenav/div/mh-navbar/aside/tree-root/div/div[4]/div/div/mh-navbar-item/div",
}


@dataclass
class Invite:
    id: str
    token: str
    platform_id: str
    platform_code: str
    platform_name: str
    guest_name: str
    room_number: str | None
    created_at: str


@dataclass
class MyHotelReview:
    guest_name: str
    source: str
    raw_text: str
    reference: str


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def env_bool(name: str, default: bool) -> bool:
    value = env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "sim", "s"}


def required_env(name: str) -> str:
    value = env(name)
    if not value:
        raise RuntimeError(f"Variavel obrigatoria ausente: {name}")
    lower_value = value.lower()
    if any(marker in lower_value for marker in ("seu-", "sua-", "your-", "sua-service-role-key")):
        raise RuntimeError(f"Variavel {name} ainda esta com valor de exemplo no .env")
    return value


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"[^a-z0-9 ]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def name_score(expected: str, actual: str) -> float:
    expected_norm = normalize_name(expected)
    actual_norm = normalize_name(actual)
    if not expected_norm or not actual_norm:
        return 0.0
    if expected_norm == actual_norm:
        return 1.0
    if len(expected_norm) >= 4 and expected_norm in actual_norm:
        return 0.96
    if len(actual_norm) >= 4 and actual_norm in expected_norm:
        return 0.93
    return SequenceMatcher(None, expected_norm, actual_norm).ratio()


def infer_source(raw_text: str) -> str:
    text = normalize_name(raw_text)
    if "tripadvisor" in text or "trip advisor" in text:
        return "tripadvisor"
    if "google" in text:
        return "google"
    return "unknown"


def supabase_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def fetch_pending_invites(supabase_url: str, service_key: str) -> list[Invite]:
    platforms_url = f"{supabase_url.rstrip('/')}/rest/v1/platforms"
    platforms_response = requests.get(
        platforms_url,
        headers=supabase_headers(service_key),
        params={"select": "id,code,name"},
        timeout=30,
    )
    platforms_response.raise_for_status()
    platforms_by_id = {row["id"]: row for row in platforms_response.json()}

    url = f"{supabase_url.rstrip('/')}/rest/v1/review_invites"
    params = {
        "select": "id,token,platform_id,guest_name,room_number,status,created_at",
        "status": "in.(emitted,opened)",
        "guest_name": "not.is.null",
        "order": "created_at.desc",
        "limit": env("PENDING_LIMIT", "250"),
    }
    response = requests.get(url, headers=supabase_headers(service_key), params=params, timeout=30)
    response.raise_for_status()

    invites: list[Invite] = []
    for row in response.json():
        platform = platforms_by_id.get(row.get("platform_id"), {})
        platform_code = platform.get("code") or ""
        if platform_code not in {"google", "tripadvisor"}:
            continue
        invites.append(
            Invite(
                id=row["id"],
                token=row["token"],
                platform_id=row["platform_id"],
                platform_code=platform_code,
                platform_name=platform.get("name") or platform_code,
                guest_name=row.get("guest_name") or "",
                room_number=row.get("room_number"),
                created_at=row.get("created_at") or "",
            )
        )
    return invites


def confirmation_exists(supabase_url: str, service_key: str, invite_id: str) -> bool:
    url = f"{supabase_url.rstrip('/')}/rest/v1/external_review_confirmations"
    params = {"select": "id", "invite_id": f"eq.{invite_id}", "limit": "1"}
    response = requests.get(url, headers=supabase_headers(service_key), params=params, timeout=20)
    response.raise_for_status()
    return bool(response.json())


def confirm_invite(
    supabase_url: str,
    service_key: str,
    invite: Invite,
    review: MyHotelReview,
    score: float,
) -> None:
    now = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    notes = (
        "Confirmado automaticamente pelo robo MyHotel. "
        f"Nome no convite: {invite.guest_name}. Nome no MyHotel: {review.guest_name}. "
        f"Canal: {invite.platform_code}. Similaridade: {score:.2f}."
    )

    if not confirmation_exists(supabase_url, service_key, invite.id):
        conf_url = f"{supabase_url.rstrip('/')}/rest/v1/external_review_confirmations"
        conf_payload = {
            "invite_id": invite.id,
            "platform_id": invite.platform_id,
            "confirmation_type": "reconciled",
            "external_review_reference": review.reference,
            "confirmed_by": "Robo MyHotel",
            "notes": notes,
        }
        response = requests.post(conf_url, headers=supabase_headers(service_key), json=conf_payload, timeout=20)
        response.raise_for_status()

    invite_url = f"{supabase_url.rstrip('/')}/rest/v1/review_invites"
    update_headers = supabase_headers(service_key)
    update_headers["Prefer"] = "return=minimal"
    response = requests.patch(
        invite_url,
        headers=update_headers,
        params={"id": f"eq.{invite.id}"},
        json={"status": "externally_reconciled", "updated_at": now},
        timeout=20,
    )
    response.raise_for_status()

    audit_url = f"{supabase_url.rstrip('/')}/rest/v1/audit_logs"
    audit_payload = {
        "actor_user_id": None,
        "action": "conciliacao automatica robo myhotel",
        "entity_type": "review_invites",
        "entity_id": invite.id,
        "metadata": {
            "token": invite.token,
            "platform": invite.platform_code,
            "guest_name": invite.guest_name,
            "myhotel_guest_name": review.guest_name,
            "reference": review.reference,
            "match_score": score,
        },
    }
    requests.post(audit_url, headers=supabase_headers(service_key), json=audit_payload, timeout=20).raise_for_status()


def start_browser(headless: bool) -> webdriver.Chrome:
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    return webdriver.Chrome(options=options)


def save_debug_snapshot(driver: webdriver.Chrome, label: str) -> None:
    debug_dir = pathlib.Path("debug")
    debug_dir.mkdir(exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_label = re.sub(r"[^a-zA-Z0-9_-]+", "-", label).strip("-") or "snapshot"
    base = debug_dir / f"{stamp}-{safe_label}"

    try:
        driver.save_screenshot(str(base.with_suffix(".png")))
    except Exception as exc:
        print(f"[DEBUG] Nao foi possivel salvar screenshot: {exc}")

    try:
        base.with_suffix(".html").write_text(driver.page_source, encoding="utf-8", errors="ignore")
        base.with_suffix(".txt").write_text(
            f"url={driver.current_url}\ntitle={driver.title}\n",
            encoding="utf-8",
        )
        print(f"[DEBUG] Snapshot salvo em: {base}")
    except Exception as exc:
        print(f"[DEBUG] Nao foi possivel salvar HTML: {exc}")


def click_if_present(driver: webdriver.Chrome, wait: WebDriverWait, xpath_name: str) -> None:
    xpath = env(xpath_name, DEFAULT_XPATHS.get(xpath_name, ""))
    if not xpath:
        return
    element = wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
    element.click()


def click_menu_text(driver: webdriver.Chrome, wait: WebDriverWait, *labels: str) -> bool:
    for label in labels:
        xpath = f"//*[normalize-space()='{label}']"
        try:
            element = wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            element.click()
            return True
        except Exception:
            continue
    return False


def scrape_myhotel_reviews() -> list[MyHotelReview]:
    login_url = env("MYHOTEL_LOGIN_URL", "https://fidelity.myhotel.cl/login")
    username = required_env("MYHOTEL_USER")
    password = required_env("MYHOTEL_PASSWORD")
    max_reviews = int(env("MYHOTEL_MAX_REVIEWS", "50"))
    headless = env_bool("ROBOT_HEADLESS", False)

    driver = start_browser(headless=headless)
    wait = WebDriverWait(driver, 25)
    reviews: list[MyHotelReview] = []

    try:
        print(f"[MYHOTEL] Abrindo login: {login_url}")
        driver.get(login_url)

        user_input = wait.until(EC.presence_of_element_located((By.XPATH, env("XPATH_USER_INPUT", DEFAULT_XPATHS["XPATH_USER_INPUT"]))))
        user_input.clear()
        user_input.send_keys(username)

        pass_input = driver.find_element(By.XPATH, env("XPATH_PASS_INPUT", DEFAULT_XPATHS["XPATH_PASS_INPUT"]))
        pass_input.clear()
        pass_input.send_keys(password)

        driver.find_element(By.XPATH, env("XPATH_LOGIN_BTN", DEFAULT_XPATHS["XPATH_LOGIN_BTN"])).click()
        time.sleep(float(env("MYHOTEL_AFTER_LOGIN_SLEEP", "6")))

        print("[MYHOTEL] Abrindo modulo Online/Avaliacoes...")
        click_if_present(driver, wait, "XPATH_ONLINE_BTN")

        reviews_button = env("XPATH_REVIEWS_BTN")
        if reviews_button and reviews_button != env("XPATH_ONLINE_BTN", DEFAULT_XPATHS["XPATH_ONLINE_BTN"]):
            click_if_present(driver, wait, "XPATH_REVIEWS_BTN")
        else:
            clicked_reviews = click_menu_text(driver, wait, "Avaliações", "Avaliacoes")
            if clicked_reviews:
                print("[MYHOTEL] Submenu Avaliacoes selecionado pelo texto.")
            else:
                print("[MYHOTEL] Submenu Avaliacoes nao encontrado pelo texto; seguindo na tela atual.")

        time.sleep(float(env("MYHOTEL_AFTER_ONLINE_SLEEP", "5")))

        cards = driver.find_elements(By.CSS_SELECTOR, "mh-single-review")
        if not cards:
            first_xpath = env("XPATH_REVIEW_CONTAINER")
            if first_xpath:
                try:
                    cards = [driver.find_element(By.XPATH, first_xpath)]
                except Exception:
                    cards = []

        if not cards:
            print("[MYHOTEL] Nenhum card mh-single-review encontrado na tela atual.")
            save_debug_snapshot(driver, "sem-cards-avaliacoes")
            return reviews

        for index, card in enumerate(cards[:max_reviews], start=1):
            raw_text = card.text.strip()
            if not raw_text:
                continue

            guest_name = ""
            for relative_xpath in (".//div/div[1]/p", ".//p"):
                try:
                    guest_name = card.find_element(By.XPATH, relative_xpath).text.strip()
                    if guest_name:
                        break
                except Exception:
                    pass

            if not guest_name:
                first_line = raw_text.splitlines()[0].strip()
                guest_name = first_line

            source = infer_source(raw_text)
            reviews.append(
                MyHotelReview(
                    guest_name=guest_name,
                    source=source,
                    raw_text=raw_text,
                    reference=f"MyHotel card #{index} - {source} - {guest_name}",
                )
            )

        print(f"[MYHOTEL] Avaliacoes lidas: {len(reviews)}")
        return reviews
    finally:
        driver.quit()


def find_best_match(invite: Invite, reviews: list[MyHotelReview], used_review_indexes: set[int]) -> tuple[int, MyHotelReview, float] | None:
    threshold = float(env("MATCH_THRESHOLD", "0.86"))
    require_source_match = env_bool("MYHOTEL_REQUIRE_SOURCE_MATCH", True)
    best: tuple[int, MyHotelReview, float] | None = None

    for index, review in enumerate(reviews):
        if index in used_review_indexes:
            continue
        if require_source_match and review.source != invite.platform_code:
            continue
        if not require_source_match and review.source not in {"unknown", invite.platform_code}:
            continue

        score = name_score(invite.guest_name, review.guest_name)
        if score < threshold:
            continue
        if best is None or score > best[2]:
            best = (index, review, score)
    return best


def run_scrape_only() -> int:
    reviews = scrape_myhotel_reviews()
    print(f"[ROBO] Avaliacoes extraidas do MyHotel: {len(reviews)}")
    for review in reviews[:10]:
        print(f"[REVIEW] nome={review.guest_name!r} canal={review.source!r} ref={review.reference!r}")
    return 0


def run(confirm: bool) -> int:
    supabase_url = required_env("SUPABASE_URL")
    service_key = required_env("SUPABASE_SERVICE_ROLE_KEY")
    dry_run = env_bool("ROBOT_DRY_RUN", True) and not confirm

    print("[ROBO] Buscando convites pendentes no Guardioes...")
    invites = fetch_pending_invites(supabase_url, service_key)
    print(f"[ROBO] Convites pendentes Google/Trip: {len(invites)}")
    if not invites:
        return 0

    reviews = scrape_myhotel_reviews()
    if not reviews:
        print("[ROBO] Nenhuma avaliacao foi lida no MyHotel.")
        return 0

    used_reviews: set[int] = set()
    matched = 0
    for invite in invites:
        match = find_best_match(invite, reviews, used_reviews)
        if not match:
            print(f"[PENDENTE] {invite.guest_name} / {invite.platform_code} / token {invite.token}")
            continue

        review_index, review, score = match
        used_reviews.add(review_index)
        matched += 1

        print(
            f"[MATCH] convite={invite.guest_name} canal={invite.platform_code} "
            f"myhotel={review.guest_name} score={score:.2f}"
        )

        if dry_run:
            print("        DRY RUN: nada foi gravado. Use --confirm ou ROBOT_DRY_RUN=false para validar.")
        else:
            confirm_invite(supabase_url, service_key, invite, review, score)
            print("        Confirmado no Guardioes.")

    print(f"[ROBO] Finalizado. Matches encontrados: {matched}. Modo dry-run: {dry_run}.")
    return 0


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Robo de conciliacao MyHotel -> Guardioes do atendimento")
    parser.add_argument("--confirm", action="store_true", help="Grava confirmacoes reais no Supabase.")
    parser.add_argument("--scrape-only", action="store_true", help="Testa apenas login/leitura do MyHotel, sem Supabase.")
    args = parser.parse_args()

    try:
        if args.scrape_only:
            return run_scrape_only()
        return run(confirm=args.confirm)
    except TimeoutException as exc:
        print(f"[ERRO] Timeout no MyHotel: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"[ERRO] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
