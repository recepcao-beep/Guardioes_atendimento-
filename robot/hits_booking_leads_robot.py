from __future__ import annotations

import datetime as dt
import os
import re
import time
import traceback
from dataclasses import dataclass, asdict
from typing import Any

import requests
from dotenv import load_dotenv
from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    ElementNotInteractableException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
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
    "XPATH_PHONE_INPUT_CELULAR": "/html/body/div[3]/div/main/div[6]/div[2]/guest-detail/div[1]/div[2]/div/fieldset/div/form/div[9]/div/div/div/div[3]/div/input",
    "XPATH_PHONE_INPUT_CELULAR_2": "/html/body/div[3]/div/main/div[6]/div[2]/guest-detail/div[1]/div[2]/div/fieldset/div/form/div[9]/div/div/div/div[5]/div/input",
    "XPATH_PHONE_INPUT_TELEFONE_2": "/html/body/div[3]/div/main/div[6]/div[2]/guest-detail/div[1]/div[2]/div/fieldset/div/form/div[9]/div/div/div/div[6]/div/input",
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


def log(message: str) -> None:
    print(message, flush=True)


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


def extract_phone_candidates(value: str | None) -> list[str]:
    if not value:
        return []

    text = re.sub(r"\s+", " ", value)
    candidates = re.findall(r"(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[\s.-]?\d{4}", text)
    candidates.extend(re.findall(r"\d[\d\s().+-]{7,}\d", text))

    phones: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        phone = clean_phone(candidate)
        if not phone:
            continue
        if len(phone) < 8 or len(phone) > 13:
            continue
        if re.fullmatch(r"\d{8}", phone) and re.search(r"\d{2}/\d{2}/\d{2,4}", candidate):
            continue
        if phone not in seen:
            phones.append(phone)
            seen.add(phone)
    return phones


def phone_input_xpaths() -> list[str]:
    configured = env("XPATH_PHONE_INPUTS")
    if configured:
        return [item.strip() for item in configured.split("|") if item.strip()]
    return [
        xpath("XPATH_PHONE_INPUT"),
        xpath("XPATH_PHONE_INPUT_CELULAR"),
        xpath("XPATH_PHONE_INPUT_CELULAR_2"),
        xpath("XPATH_PHONE_INPUT_TELEFONE_2"),
    ]


def clean_guest_name(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    cleaned = re.sub(r"^\d{1,2}:\d{2}\s*", "", cleaned)
    cleaned = re.sub(r"^\d{2}/\d{2}/\d{2,4}(?:\s+\d{1,2}:\d{2})?\s*", "", cleaned)
    cleaned = re.split(r"\s*\|\s*|BOOKING\.?COM|FECHADO|CONTA", cleaned, flags=re.IGNORECASE)[0].strip()
    cleaned = cleaned.split(",")[0].strip()
    cleaned = re.sub(r"^[^A-Za-zÀ-ÿ]+", "", cleaned).strip()
    return cleaned if re.search(r"[A-Za-zÀ-ÿ]", cleaned) else None


def looks_like_guest_name(value: str) -> bool:
    upper = value.upper()
    blocked = [
        "BOOKING", "FECHADO", "CONTA", "BASE", "WALK-IN", "WALK IN",
        "LANC", "LANÇ", "TAXA", "OBJETO", "TOTAL", "R$", "CPF",
        "CNPJ", "TELEFONE", "CELULAR", "EMAIL", "CHECK", "GLOBAL"
    ]
    if any(item in upper for item in blocked):
        return False
    if re.search(r"\d{2}/\d{2}/\d{2,4}", value):
        return False
    if re.fullmatch(r"[\d\s()./-]+", value):
        return False
    if re.search(r"\d{4,}-\d{3,}", value):
        return False
    return bool(re.search(r"[A-Za-zÀ-ÿ]", value)) and len(value.strip()) >= 4


def start_browser() -> webdriver.Chrome:
    options = Options()
    options.set_capability("pageLoadStrategy", "eager")
    if env_bool("ROBOT_HEADLESS", True):
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-sync")
    options.add_argument("--window-size=1440,1200")
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(int(env("HITS_PAGE_LOAD_TIMEOUT", "45")))
    return driver


def safe_click(driver: webdriver.Chrome, element: Any) -> None:
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", element)
    time.sleep(0.25)
    try:
        element.click()
    except (ElementClickInterceptedException, ElementNotInteractableException, StaleElementReferenceException):
        driver.execute_script("arguments[0].click();", element)


def wait_click(driver: webdriver.Chrome, wait: WebDriverWait, xpath_value: str) -> None:
    last_error: Exception | None = None
    for _ in range(3):
        try:
            element = wait.until(EC.element_to_be_clickable((By.XPATH, xpath_value)))
            safe_click(driver, element)
            return
        except (ElementClickInterceptedException, StaleElementReferenceException, TimeoutException) as exc:
            last_error = exc
            time.sleep(0.8)
    if last_error:
        raise last_error


def wait_type(driver: webdriver.Chrome, wait: WebDriverWait, xpath_value: str, value: str) -> None:
    element = wait.until(EC.visibility_of_element_located((By.XPATH, xpath_value)))
    safe_click(driver, element)
    element.clear()
    element.send_keys(value)


def confirm_open_filter(driver: webdriver.Chrome, wait: WebDriverWait) -> None:
    apply_buttons = driver.find_elements(By.XPATH, "//button[contains(@class, 'applyBtn')]")
    for button in apply_buttons:
        try:
            if button.is_displayed() and button.is_enabled():
                safe_click(driver, button)
                time.sleep(2)
                break
        except (ElementNotInteractableException, StaleElementReferenceException):
            continue

    wait_click(driver, wait, xpath("XPATH_FILTER_CONFIRM"))


def wait_type_date_range(driver: webdriver.Chrome, wait: WebDriverWait, xpath_value: str, value: str) -> None:
    element = wait.until(EC.element_to_be_clickable((By.XPATH, xpath_value)))
    safe_click(driver, element)

    # HITS valida esse campo pelos eventos do teclado; segue o mesmo fluxo do mr.py.
    element.send_keys(Keys.CONTROL + "a")
    element.send_keys(Keys.DELETE)
    element.send_keys(value)
    element.send_keys(Keys.ENTER)
    time.sleep(2)


def login_and_filter(driver: webdriver.Chrome, date_from: str, date_to: str) -> None:
    wait = WebDriverWait(driver, int(env("HITS_WAIT_SECONDS", "25")))
    log("[HITS] Abrindo pagina de login...")
    driver.get(required_env("HITS_LOGIN_URL"))
    log("[HITS] Informando usuario...")
    wait_type(driver, wait, xpath("XPATH_HITS_USER"), required_env("HITS_USER"))
    log("[HITS] Informando senha...")
    wait_type(driver, wait, xpath("XPATH_HITS_PASSWORD"), required_env("HITS_PASSWORD"))
    log("[HITS] Clicando em entrar...")
    wait_click(driver, wait, xpath("XPATH_HITS_LOGIN_BTN"))
    time.sleep(8)

    for item in ("XPATH_HITS_SIDE_MENU", "XPATH_HITS_ACCOUNT", "XPATH_HITS_SUBACCOUNT"):
        log(f"[HITS] Navegando menu: {item}...")
        wait_click(driver, wait, xpath(item))
        time.sleep(1.5)

    log("[HITS] Aplicando filtro empresa Booking.com...")
    wait_click(driver, wait, xpath("XPATH_COMPANY_FILTER"))
    wait_type(driver, wait, xpath("XPATH_FILTER_INPUT"), "Booking.com")
    confirm_open_filter(driver, wait)
    time.sleep(2)

    log("[HITS] Aplicando filtro status Fechado...")
    wait_click(driver, wait, xpath("XPATH_STATUS_FILTER"))
    wait_click(driver, wait, xpath("XPATH_STATUS_CLOSED"))
    confirm_open_filter(driver, wait)
    time.sleep(2)

    log(f"[HITS] Aplicando filtro data {br_range(date_from, date_to)}...")
    wait_click(driver, wait, xpath("XPATH_DATE_FILTER"))
    wait_type_date_range(driver, wait, xpath("XPATH_DATE_INPUT"), br_range(date_from, date_to))
    confirm_open_filter(driver, wait)
    time.sleep(5)
    log("[HITS] Filtros aplicados. Iniciando leitura da lista...")


def row_xpath(index: int) -> str:
    return f"/html/body/div[3]/div/main/div[31]/div[1]/folio-list/div/div/div[3]/div[1]/div/div[1]/div[2]/div/div[{index}]"


def row_pencil_xpath(index: int) -> str:
    return f"{row_xpath(index)}/div/div[1]/div/div/div[1]/a[1]"


def row_room_xpath(index: int) -> str:
    return f"{row_xpath(index)}/div/div[4]"


def row_guest_xpath(index: int) -> str:
    return f"{row_xpath(index)}/div/div[7]/div"


def element_text(driver: webdriver.Chrome, element: Any) -> str:
    text = element.text or ""
    if not text.strip():
        text = driver.execute_script("return arguments[0].textContent || '';", element) or ""
    return re.sub(r"\s+", "\n", text).strip()


def text_by_xpath(driver: webdriver.Chrome, xpath_value: str) -> str | None:
    try:
        elements = driver.find_elements(By.XPATH, xpath_value)
        for element in elements:
            text = element_text(driver, element)
            if text:
                return text
    except Exception:
        return None
    return None


def element_value(driver: webdriver.Chrome, element: Any) -> str:
    value = element.get_attribute("value") or element.text or ""
    if value.strip():
        return value
    try:
        value = driver.execute_script(
            "return arguments[0].value || arguments[0].getAttribute('value') || arguments[0].textContent || arguments[0].innerText || '';",
            element
        ) or ""
    except Exception:
        value = ""
    return str(value)


def parse_row_text(text: str) -> dict[str, str | None]:
    parts = [part.strip() for part in re.split(r"\n+", text) if part.strip()]
    joined = " | ".join(parts)
    room = None
    guest = None
    folio = None
    dates = re.findall(r"\d{2}/\d{2}/\d{2,4}", joined)
    for part in parts:
        if re.fullmatch(r"\d{2,5}(?:\s*\([^)]*\))?", part):
            room = room or part
        if re.search(r"\d{4,}-\d{3,}", part):
            folio = folio or part
        elif re.search(r"\d{5,}", part) and not folio:
            folio = part
    guest_candidates = [part for part in parts if looks_like_guest_name(part)]
    if guest_candidates:
        guest_candidates.sort(key=lambda item: (len(item.split()) < 2, len(item)))
        guest = guest_candidates[0]
    guest = clean_guest_name(guest) or "Hospede Booking"
    return {
        "folio_identifier": folio,
        "room_number": room,
        "guest_name": guest,
        "stay_start": parse_br_date(dates[0]) if dates else None,
        "stay_end": parse_br_date(dates[-1]) if dates else None,
        "raw": joined,
    }


def dismiss_guest_popup(driver: webdriver.Chrome) -> None:
    popup_xpaths = [
        xpath("XPATH_GUEST_POPUP_OK"),
        "//button[normalize-space()='OK']",
        "//button[contains(translate(normalize-space(.), 'ok', 'OK'), 'OK')]",
    ]
    for popup_xpath in popup_xpaths:
        try:
            buttons = driver.find_elements(By.XPATH, popup_xpath)
            for button in buttons:
                if button.is_displayed() and button.is_enabled():
                    safe_click(driver, button)
                    time.sleep(0.8)
                    return
        except Exception:
            continue


def click_guest_link(driver: webdriver.Chrome, wait: WebDriverWait, expected_name: str | None = None) -> None:
    wait.until(EC.presence_of_element_located((By.XPATH, "//folio-detail")))
    expected_clean = clean_guest_name(expected_name or "") or ""

    candidate_links = driver.find_elements(By.XPATH, "//folio-detail//a[.//span or normalize-space()]")
    best_link = None
    for link in candidate_links:
        text = element_text(driver, link)
        cleaned = clean_guest_name(text)
        if not cleaned:
            continue
        upper = text.upper()
        if any(blocked in upper for blocked in ["BOOKING", "BASE", "WALK-IN", "LANÇ", "TAXAS", "OBJETOS"]):
            continue
        if re.search(r"\d{2}/\d{2}/\d{2,4}", text):
            continue
        if expected_clean and expected_clean.split()[0].upper() in cleaned.upper():
            safe_click(driver, link)
            return
        best_link = best_link or link

    if best_link:
        safe_click(driver, best_link)
        return

    wait_click(driver, wait, xpath("XPATH_GUEST_LINK"))


def collect_phones_on_guest_detail(driver: webdriver.Chrome, wait: WebDriverWait) -> str | None:
    wait.until(EC.presence_of_element_located((By.XPATH, "//guest-detail")))
    time.sleep(1.5)

    phones: list[str] = []
    seen: set[str] = set()

    phone_hints = ("tel", "telefone", "cel", "celular", "whats", "phone", "contato")
    document_hints = ("cpf", "cnpj", "rg", "document", "passaporte", "cep", "postal")

    def add_phone(value: str | None, hint: str = "") -> None:
        hint_lower = hint.lower()
        has_phone_hint = any(item in hint_lower for item in phone_hints)
        has_document_hint = any(item in hint_lower for item in document_hints)
        if has_document_hint and not has_phone_hint:
            return
        for phone in extract_phone_candidates(value):
            if len(phone) == 8 and not has_phone_hint:
                continue
            if phone not in seen:
                phones.append(phone)
                seen.add(phone)

    for _ in range(5):
        for phone_xpath in phone_input_xpaths():
            for phone_el in driver.find_elements(By.XPATH, phone_xpath):
                add_phone(element_value(driver, phone_el), "configured telefone")
        if phones:
            break
        time.sleep(0.8)

    # Fallback: em alguns cadastros o HITS muda a posicao interna dos campos.
    fallback_xpath = "/html/body/div[3]/div/main/div[6]/div[2]/guest-detail/div[1]/div[2]/div/fieldset/div/form/div[9]//input"
    for phone_el in driver.find_elements(By.XPATH, fallback_xpath):
        hint = " ".join([
            phone_el.get_attribute("name") or "",
            phone_el.get_attribute("id") or "",
            phone_el.get_attribute("placeholder") or "",
            phone_el.get_attribute("aria-label") or "",
        ])
        add_phone(element_value(driver, phone_el), hint or "telefone")

    dom_candidates = driver.execute_script(
        """
        const root = document.querySelector('guest-detail') || document.body;
        const nodes = Array.from(root.querySelectorAll('input, textarea, [contenteditable="true"], span, div, a'));
        const result = [];
        const isVisible = (el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const attr = (el, name) => el.getAttribute(name) || '';
        for (const el of nodes) {
          if (!isVisible(el)) continue;
          const tag = el.tagName.toLowerCase();
          const value = 'value' in el ? String(el.value || '') : String(el.textContent || '');
          const parentText = String(el.parentElement?.innerText || '').slice(0, 240);
          const grandText = String(el.parentElement?.parentElement?.innerText || '').slice(0, 240);
          const hint = [
            tag, attr(el, 'name'), attr(el, 'id'), attr(el, 'class'), attr(el, 'type'),
            attr(el, 'placeholder'), attr(el, 'aria-label'), attr(el, 'title'),
            parentText, grandText
          ].join(' ');
          const hintLower = hint.toLowerCase();
          const isField = tag === 'input' || tag === 'textarea' || el.isContentEditable;
          const hasPhoneHint = /tel|telefone|celular|cel\\b|whats|phone|contato/.test(hintLower);
          if (isField || hasPhoneHint) result.push({ value, hint });
        }
        return result.slice(0, 600);
        """
    )
    for item in dom_candidates or []:
        add_phone(str(item.get("value") or ""), str(item.get("hint") or ""))

    return " / ".join(phones) if phones else None


def return_to_folio_list(driver: webdriver.Chrome, wait: WebDriverWait) -> None:
    try:
        if driver.find_elements(By.XPATH, "//guest-detail"):
            wait_click(driver, WebDriverWait(driver, 8), xpath("XPATH_GUEST_BACK"))
            time.sleep(1.5)
    except Exception:
        try:
            driver.back()
            time.sleep(1.5)
        except Exception:
            pass

    try:
        if driver.find_elements(By.XPATH, "//folio-detail"):
            wait_click(driver, WebDriverWait(driver, 8), xpath("XPATH_FOLIO_BACK"))
            time.sleep(1.5)
    except Exception:
        try:
            driver.back()
            time.sleep(1.5)
        except Exception:
            pass


def collect_phone_from_detail(driver: webdriver.Chrome, wait: WebDriverWait, expected_name: str | None = None) -> str | None:
    log(f"[HITS] Abrindo ficha do hospede {expected_name or ''}...")
    click_guest_link(driver, wait, expected_name)
    time.sleep(1)
    dismiss_guest_popup(driver)
    phones = collect_phones_on_guest_detail(driver, wait)
    return_to_folio_list(driver, wait)
    return phones


def scrape_leads(driver: webdriver.Chrome, date_from: str, date_to: str) -> list[BookingLead]:
    wait = WebDriverWait(driver, 30)
    leads: list[BookingLead] = []
    max_rows = int(env("HITS_MAX_ROWS", "80"))

    for index in range(1, max_rows + 1):
        try:
            row = wait.until(EC.presence_of_element_located((By.XPATH, row_xpath(index))))
        except Exception:
            break

        row_text = element_text(driver, row)
        parsed = parse_row_text(row_text)

        explicit_room = text_by_xpath(driver, row_room_xpath(index))
        explicit_guest = text_by_xpath(driver, row_guest_xpath(index))
        if explicit_room:
            parsed["room_number"] = explicit_room.splitlines()[0].strip()
        if explicit_guest:
            parsed["guest_name"] = clean_guest_name(explicit_guest) or parsed["guest_name"]

        if not parsed["folio_identifier"]:
            parsed["folio_identifier"] = f"hits-booking-{date_from}-{date_to}-linha-{index}"
            log(f"[HITS] Linha {index}: identificador nao encontrado, usando fallback por linha.")
        if parsed["guest_name"] == "Hospede Booking" and not parsed["room_number"] and not parsed["raw"]:
            log(f"[HITS] Linha {index}: sem dados legiveis, ignorando.")
            continue
        log(f"[HITS] Linha {index}: {parsed['guest_name']} quarto={parsed['room_number']}")

        if not parsed["room_number"]:
            log(f"[HITS] Linha {index}: ignorada porque nao foi possivel identificar o quarto.")
            continue

        if parsed["guest_name"] == "Hospede Booking":
            log(f"[HITS] Linha {index}: ignorada porque o nome do hospede nao foi identificado com seguranca.")
            continue

        try:
            wait_click(driver, wait, row_pencil_xpath(index))
            time.sleep(3)
            phone = collect_phone_from_detail(driver, wait, str(parsed["guest_name"]))
            log(f"[HITS] Telefones linha {index}: {phone or 'nenhum'}")
        except Exception as exc:
            log(f"[HITS] Falha ao coletar telefone da linha {index}: {exc}")
            return_to_folio_list(driver, wait)
            phone = None

        if not phone:
            log(f"[HITS] Linha {index}: ignorada porque nenhum telefone valido foi coletado.")
            continue

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
        log("[HITS] Nenhum lead para salvar.")
        return
    supabase_url = required_env("SUPABASE_URL").rstrip("/")
    service_key = required_env("SUPABASE_SERVICE_ROLE_KEY")
    unique_leads: dict[str, BookingLead] = {}
    for lead in leads:
        if lead.folio_identifier in unique_leads:
            suffix = lead.source_payload.get("row_index") if lead.source_payload else len(unique_leads) + 1
            lead.folio_identifier = f"{lead.folio_identifier}-{suffix}"
        unique_leads[lead.folio_identifier] = lead

    payload = [asdict(lead) for lead in unique_leads.values()]
    response = requests.post(
        f"{supabase_url}/rest/v1/booking_leads",
        headers=supabase_headers(service_key),
        params={"on_conflict": "folio_identifier"},
        json=payload,
        timeout=60,
    )
    if not response.ok:
        log(f"[HITS] Erro Supabase {response.status_code}: {response.text[:1200]}")
    response.raise_for_status()
    log(f"[HITS] Leads salvos/atualizados: {len(payload)}")


def main() -> None:
    load_dotenv()
    date_from = required_env("BOOKING_DATE_FROM")
    date_to = required_env("BOOKING_DATE_TO")
    log(f"[HITS] Robo iniciado. Periodo: {date_from} ate {date_to}.")
    driver = start_browser()
    try:
        login_and_filter(driver, date_from, date_to)
        leads = scrape_leads(driver, date_from, date_to)
        upsert_leads(leads)
    except Exception:
        os.makedirs("robot/debug", exist_ok=True)
        screenshot_path = "robot/debug/hits-booking-error.png"
        html_path = "robot/debug/hits-booking-error.html"
        try:
            driver.save_screenshot(screenshot_path)
            with open(html_path, "w", encoding="utf-8") as file:
                file.write(driver.page_source)
            log(f"[HITS] Debug salvo em {screenshot_path} e {html_path}")
        except Exception as debug_error:
            log(f"[HITS] Falha ao salvar debug: {debug_error}")
        log(traceback.format_exc())
        raise
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
