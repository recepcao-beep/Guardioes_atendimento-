from __future__ import annotations

import datetime as dt
import os
import re
import time
from dataclasses import dataclass, asdict
from typing import Any

import requests
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


DEFAULT_XPATHS = {
    "XPATH_HITS_USER": "/html/body/div[1]/div/div[1]/div[1]/section/form/div[1]/div[1]/input",
    "XPATH_HITS_PASSWORD": "/html/body/div[1]/div/div[1]/div[1]/section/form/div[1]/div[2]/input",
    "XPATH_HITS_LOGIN_BTN": "/html/body/div[1]/div/div[1]/div[1]/section/form/div[1]/div[3]/div/button",
    "XPATH_HITS_SIDE_MENU": "/html/body/div[3]/div/header/nav[1]/ul/li[1]/a",
    "XPATH_HITS_ACCOUNT": "/html/body/div[3]/div/header/nav[6]/div/ul/li[5]/a",
    "XPATH_HITS_SUBACCOUNT": "/html/body/div[3]/div/header/nav[6]/div/ul/li[5]/ul/li[1]/a",
    "XPATH_COMPANY_FILTER": "/html/body/div[3]/div/main/div[31]/div[1]/folio-list/div/div/div[1]/div/div[2]/span[8]",
    "XPATH_FILTER_INPUT": "/html/body/div[1]/div/div/div[3]/div/input",
    "XPATH_FILTER_CONFIRM": "/html/body/div[1]/div/div/div[4]/button",
    "XPATH_STATUS_FILTER": "/html/body/div[3]/div/main/div[31]/div[1]/folio-list/div/div/div[1]/div/div[1]/button[2]",
    "XPATH_STATUS_CLOSED": "/html/body/div[1]/div/div/div[3]/div/div/div[2]",
    "XPATH_DATE_FILTER": "/html/body/div[3]/div/main/div[31]/div[1]/folio-list/div/div/div[1]/div/div[2]/span[6]/one-translate",
    "XPATH_DATE_INPUT": "/html/body/div[1]/div/div/div[3]/div/div/input",
    "XPATH_ROWS_COUNT": "/html/body/div[3]/div/main/div[31]/div[1]/folio-list/div/div/div[3]/div[2]/div/span",
    "XPATH_GUEST_LINK": "/html/body/div[3]/div/main/div[31]/div[3]/folio-detail/div[1]/div[2]/div/div[1]/div[1]/div[2]/div[1]/div[2]/div[1]/div[2]/div/a/span",
    "XPATH_GUEST_POPUP_OK": "/html/body/div[6]/div[7]/div/button",
    "XPATH_PHONE_INPUT": "/html/body/div[3]/div/main/div[6]/div[2]/guest-detail/div[1]/div[2]/div/fieldset/div/form/div[9]/div/div/div/div[2]/div/input",
    "XPATH_GUEST_BACK": "/html/body/div[3]/div/main/div[6]/div[2]/guest-detail/div[9]/div/div/button[1]",
    "XPATH_FOLIO_BACK": "/html/body/div[3]/div/main/div[31]/div[3]/folio-detail/div[5]/div/button[1]",
}


@dataclass
class BookingLead:
    folio_identifier: str
    global_code: str | None
    guest_name: str
    room_number: str | None
    stay_start: str | None
    stay_end: str | None
    phone: str | None
    company: str = "BOOKING.COM"
    status: str = "Fechado"
    source_payload: dict[str, Any] | None = None


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def required_env(name: str) -> str:
    value = env(name)
    if not value:
        raise RuntimeError(f"Variavel obrigatoria ausente: {name}")
    return value


def xpath(name: str) -> str:
    return env(name, DEFAULT_XPATHS[name])


def env_bool(name: str, default: bool) -> bool:
    value = env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "sim", "s"}


def br_range(date_from: str, date_to: str) -> str:
    start = dt.date.fromisoformat(date_from)
    end = dt.date.fromisoformat(date_to)
    return f"{start:%d/%m/%y} - {end:%d/%m/%y}"


def parse_br_date(value: str) -> str | None:
    match = re.search(r"(\d{2})/(\d{2})/(\d{2,4})", value or "")
    if not match:
      return None
    day, month, year = match.groups()
    year = f"20{year}" if len(year) == 2 else year
    return f"{year}-{month}-{day}"


def clean_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D+", "", value)
    return digits or None


def start_browser() -> webdriver.Chrome:
    options = Options()
    if env_bool("ROBOT_HEADLESS", True):
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1440,1200")
    return webdriver.Chrome(options=options)


def wait_click(driver: webdriver.Chrome, wait: WebDriverWait, xpath_value: str) -> None:
    wait.until(EC.element_to_be_clickable((By.XPATH, xpath_value))).click()


def wait_type(driver: webdriver.Chrome, wait: WebDriverWait, xpath_value: str, value: str) -> None:
    element = wait.until(EC.visibility_of_element_located((By.XPATH, xpath_value)))
    element.click()
    element.clear()
    element.send_keys(value)


def login_and_filter(driver: webdriver.Chrome, date_from: str, date_to: str) -> None:
    wait = WebDriverWait(driver, 40)
    driver.get(required_env("HITS_LOGIN_URL"))
    wait_type(driver, wait, xpath("XPATH_HITS_USER"), required_env("HITS_USER"))
    wait_type(driver, wait, xpath("XPATH_HITS_PASSWORD"), required_env("HITS_PASSWORD"))
    wait_click(driver, wait, xpath("XPATH_HITS_LOGIN_BTN"))
    time.sleep(8)

    for item in ("XPATH_HITS_SIDE_MENU", "XPATH_HITS_ACCOUNT", "XPATH_HITS_SUBACCOUNT"):
        wait_click(driver, wait, xpath(item))
        time.sleep(1.5)

    wait_click(driver, wait, xpath("XPATH_COMPANY_FILTER"))
    wait_type(driver, wait, xpath("XPATH_FILTER_INPUT"), "Booking.com")
    wait_click(driver, wait, xpath("XPATH_FILTER_CONFIRM"))
    time.sleep(2)

    wait_click(driver, wait, xpath("XPATH_STATUS_FILTER"))
    wait_click(driver, wait, xpath("XPATH_STATUS_CLOSED"))
    wait_click(driver, wait, xpath("XPATH_FILTER_CONFIRM"))
    time.sleep(2)

    wait_click(driver, wait, xpath("XPATH_DATE_FILTER"))
    wait_type(driver, wait, xpath("XPATH_DATE_INPUT"), br_range(date_from, date_to))
    wait_click(driver, wait, xpath("XPATH_FILTER_CONFIRM"))
    time.sleep(5)


def row_xpath(index: int) -> str:
    return f"/html/body/div[3]/div/main/div[31]/div[1]/folio-list/div/div/div[3]/div[1]/div/div[1]/div[2]/div/div[{index}]/div/div[1]"


def row_pencil_xpath(index: int) -> str:
    return f"{row_xpath(index)}/div/div/div[1]/a[1]"


def parse_row_text(text: str) -> dict[str, str | None]:
    parts = [part.strip() for part in re.split(r"\n+", text) if part.strip()]
    joined = " | ".join(parts)
    room = None
    guest = None
    folio = None
    dates = re.findall(r"\d{2}/\d{2}/\d{2,4}", joined)
    for part in parts:
        if re.fullmatch(r"\d{2,5}", part):
            room = room or part
        if "BOOKING" not in part.upper() and len(part) > 4 and re.search(r"[A-ZÁÉÍÓÚÃÕÇ]", part):
            guest = guest or part
        if re.search(r"\d{5,}", part):
            folio = folio or part
    return {
        "folio_identifier": folio or re.sub(r"\W+", "-", joined)[:80],
        "room_number": room,
        "guest_name": guest or "Hospede Booking",
        "stay_start": parse_br_date(dates[0]) if dates else None,
        "stay_end": parse_br_date(dates[-1]) if dates else None,
        "raw": joined,
    }


def collect_phone_from_detail(driver: webdriver.Chrome, wait: WebDriverWait) -> str | None:
    wait_click(driver, wait, xpath("XPATH_GUEST_LINK"))
    time.sleep(1)
    try:
        wait_click(driver, WebDriverWait(driver, 5), xpath("XPATH_GUEST_POPUP_OK"))
    except Exception:
        pass
    time.sleep(3)
    phone_el = wait.until(EC.presence_of_element_located((By.XPATH, xpath("XPATH_PHONE_INPUT"))))
    phone = phone_el.get_attribute("value") or phone_el.text
    wait_click(driver, wait, xpath("XPATH_GUEST_BACK"))
    time.sleep(2)
    wait_click(driver, wait, xpath("XPATH_FOLIO_BACK"))
    time.sleep(2)
    return clean_phone(phone)


def scrape_leads(driver: webdriver.Chrome, date_from: str, date_to: str) -> list[BookingLead]:
    wait = WebDriverWait(driver, 30)
    leads: list[BookingLead] = []
    max_rows = int(env("HITS_MAX_ROWS", "80"))

    for index in range(1, max_rows + 1):
        try:
            row = wait.until(EC.presence_of_element_located((By.XPATH, row_xpath(index))))
        except Exception:
            break

        parsed = parse_row_text(row.text)
        print(f"[HITS] Linha {index}: {parsed['guest_name']} quarto={parsed['room_number']}")

        try:
            wait_click(driver, wait, row_pencil_xpath(index))
            time.sleep(3)
            phone = collect_phone_from_detail(driver, wait)
        except Exception as exc:
            print(f"[HITS] Falha ao coletar telefone da linha {index}: {exc}")
            phone = None

        leads.append(BookingLead(
            folio_identifier=str(parsed["folio_identifier"]),
            global_code=None,
            guest_name=str(parsed["guest_name"]),
            room_number=parsed["room_number"],
            stay_start=parsed["stay_start"] or date_from,
            stay_end=parsed["stay_end"] or date_to,
            phone=phone,
            source_payload={"raw": parsed["raw"], "row_index": index},
        ))

    return leads


def supabase_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def upsert_leads(leads: list[BookingLead]) -> None:
    if not leads:
        print("[HITS] Nenhum lead para salvar.")
        return
    supabase_url = required_env("SUPABASE_URL").rstrip("/")
    service_key = required_env("SUPABASE_SERVICE_ROLE_KEY")
    payload = [asdict(lead) for lead in leads]
    response = requests.post(
        f"{supabase_url}/rest/v1/booking_leads",
        headers=supabase_headers(service_key),
        params={"on_conflict": "folio_identifier"},
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    print(f"[HITS] Leads salvos/atualizados: {len(leads)}")


def main() -> None:
    load_dotenv()
    date_from = required_env("BOOKING_DATE_FROM")
    date_to = required_env("BOOKING_DATE_TO")
    driver = start_browser()
    try:
        login_and_filter(driver, date_from, date_to)
        leads = scrape_leads(driver, date_from, date_to)
        upsert_leads(leads)
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
