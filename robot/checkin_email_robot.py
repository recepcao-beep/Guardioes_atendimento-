from __future__ import annotations

import base64
import html
import json
import os
import re
import time
import traceback
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


BASE_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = BASE_DIR / "Downloads_Hospedes"
DEBUG_DIR = BASE_DIR / "debug"
GMAIL_FULL_ACCESS_SCOPE = "https://mail.google.com/"
SCOPES = [GMAIL_FULL_ACCESS_SCOPE]
DEFAULT_HITS_LOGIN_URL = (
    "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F"
    "response_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26"
    "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile"
    "%2520webapi%26nonce%3DN0.97234054408527631775976059311%26state%3D17759760593110.8316264461059557"
)


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def env_bool(name: str, default: bool) -> bool:
    value = env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "sim", "s"}


def required_env(*names: str) -> str:
    for name in names:
        value = env(name)
        if value:
            return value
    raise RuntimeError(f"Variavel obrigatoria ausente: {' ou '.join(names)}")


def log(message: str) -> None:
    print(message, flush=True)


def decode_secret_json(value: str) -> dict[str, Any]:
    value = value.strip()
    if not value:
        return {}
    if value.startswith("{"):
        return json.loads(value)
    return json.loads(base64.b64decode(value).decode("utf-8"))


def load_json_from_env_or_file(env_name: str, path_env_name: str, default_filename: str) -> dict[str, Any]:
    raw = env(env_name)
    if raw:
        return decode_secret_json(raw)

    configured_path = env(path_env_name)
    path = Path(configured_path) if configured_path else BASE_DIR / default_filename
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    return {}


def autenticar_gmail():
    token_info = load_json_from_env_or_file("GMAIL_TOKEN_JSON", "GMAIL_TOKEN_PATH", "token.json")
    credentials_info = load_json_from_env_or_file("GMAIL_CREDENTIALS_JSON", "GMAIL_CREDENTIALS_PATH", "credentials.json")

    creds = Credentials.from_authorized_user_info(token_info, SCOPES) if token_info else None
    token_scopes = token_info.get("scopes") if token_info else []
    if creds and GMAIL_FULL_ACCESS_SCOPE not in token_scopes:
        if env_bool("ROBOT_HEADLESS", True):
            raise RuntimeError("Gmail token sem permissao de exclusao permanente. Gere GMAIL_TOKEN_JSON com escopo https://mail.google.com/.")
        log("[EMAIL] Token Gmail sem permissao de exclusao permanente. Abrindo autorizacao local...")
        creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except RefreshError:
                if env_bool("ROBOT_HEADLESS", True):
                    raise
                log("[EMAIL] Token Gmail expirado/revogado. Abrindo autorizacao local para gerar novo token...")
                creds = None

        if not creds or not creds.valid:
            if env_bool("ROBOT_HEADLESS", True):
                raise RuntimeError("Gmail token invalido/ausente. Configure GMAIL_TOKEN_JSON nos Secrets.")
            if not credentials_info:
                raise RuntimeError("credentials.json ausente. Configure GMAIL_CREDENTIALS_JSON ou GMAIL_CREDENTIALS_PATH.")
            temp_credentials = BASE_DIR / ".credentials.local.json"
            temp_credentials.write_text(json.dumps(credentials_info), encoding="utf-8")
            flow = InstalledAppFlow.from_client_secrets_file(str(temp_credentials), SCOPES)
            creds = flow.run_local_server(port=0)

        if not env_bool("ROBOT_HEADLESS", True):
            (BASE_DIR / "token.json").write_text(creds.to_json(), encoding="utf-8")

    return build("gmail", "v1", credentials=creds)


def extrair_numero_reserva(texto: str) -> str | None:
    match = re.search(r"(\d{7})", texto or "")
    return match.group(1) if match else None


def extrair_data_checkin(texto: str) -> date | None:
    match_iso = re.search(r"(\d{4}-\d{2}-\d{2})", texto or "")
    if match_iso:
        try:
            return datetime.strptime(match_iso.group(1), "%Y-%m-%d").date()
        except ValueError:
            pass

    match_br = re.search(r"(\d{2}/\d{2}/\d{4})", texto or "")
    if match_br:
        try:
            return datetime.strptime(match_br.group(1), "%d/%m/%Y").date()
        except ValueError:
            pass

    return None


def normalizar_documento(valor: str | None) -> str:
    return re.sub(r"\D+", "", valor or "")


def normalizar_nome(valor: str | None) -> str:
    texto = unicodedata.normalize("NFKD", valor or "")
    texto = "".join(ch for ch in texto if not unicodedata.combining(ch))
    texto = re.sub(r"[^A-Za-z\s]", " ", texto).upper()
    return re.sub(r"\s+", " ", texto).strip()


def nomes_correspondem(nome_a: str | None, nome_b: str | None) -> bool:
    a = normalizar_nome(nome_a)
    b = normalizar_nome(nome_b)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    tokens_a = [t for t in a.split() if len(t) > 2]
    tokens_b = [t for t in b.split() if len(t) > 2]
    if len(tokens_a) < 2 or len(tokens_b) < 2:
        return False
    return tokens_a[0] == tokens_b[0] and tokens_a[-1] == tokens_b[-1]


def extrair_cpf(texto: str) -> str | None:
    texto = html.unescape(re.sub(r"<[^>]+>", "\n", texto or ""))
    padroes = [
        r"N[uú]mero\D{0,500}(\d{11})\D{0,500}(?:NIF\s*/\s*)?CPF",
        r"N[uú]mero\D{0,500}(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\D{0,500}(?:NIF\s*/\s*)?CPF",
        r"CPF\D{0,20}(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        r"Documento\D{0,20}(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        r"N[uú]mero\D{0,20}(\d{3}\.?\d{3}\.?\d{3}-?\d{2})",
        r"(\d{3}\.\d{3}\.\d{3}-\d{2})",
    ]
    for padrao in padroes:
        match = re.search(padrao, texto, re.IGNORECASE | re.DOTALL)
        if match:
            return normalizar_documento(match.group(1))
    return None


def extrair_nome_hospede_email(texto: str) -> str | None:
    texto = re.sub(r"<[^>]+>", "\n", texto or "")
    linhas = [re.sub(r"\s+", " ", linha).strip() for linha in texto.splitlines()]
    padroes = [
        r"^(?:Hospede|H[oó]spede|Nome|Nome completo|Guest|Name)\s*[:\-]\s*(.+)$",
        r"^(?:Titular|Cliente)\s*[:\-]\s*(.+)$",
    ]
    bloqueios = {"RESERVA", "CHECK", "CPF", "DOCUMENTO", "EMAIL", "TELEFONE", "CELULAR"}
    for linha in linhas:
        for padrao in padroes:
            match = re.search(padrao, linha, re.IGNORECASE)
            if not match:
                continue
            candidato = match.group(1).strip()
            candidato = re.split(r"\s{2,}|CPF|Documento|E-mail|Email|Telefone", candidato, flags=re.IGNORECASE)[0].strip()
            if len(candidato) >= 5 and not any(b in candidato.upper() for b in bloqueios):
                return candidato
    return None


def extrair_texto_completo_email(payload: dict[str, Any]) -> str:
    texto = ""
    if "parts" in payload:
        for part in payload["parts"]:
            if part.get("mimeType") in ["text/plain", "text/html"] and "data" in part.get("body", {}):
                texto += base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
            elif "parts" in part:
                texto += extrair_texto_completo_email(part)
    elif "data" in payload.get("body", {}):
        texto += base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
    return texto


def iterar_anexos(payload: dict[str, Any]):
    for part in payload.get("parts", []):
        if part.get("filename"):
            yield part
        if part.get("parts"):
            yield from iterar_anexos(part)


def clique_forcado(xpath: str, driver: webdriver.Chrome, wait: WebDriverWait) -> None:
    elemento = wait.until(EC.presence_of_element_located((By.XPATH, xpath)))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elemento)
    time.sleep(1)
    driver.execute_script("arguments[0].click();", elemento)


def clicar_primeiro_possivel(driver: webdriver.Chrome, xpaths: list[str], timeout: int = 8) -> bool:
    for xp in xpaths:
        try:
            elemento = WebDriverWait(driver, timeout).until(EC.presence_of_element_located((By.XPATH, xp)))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elemento)
            time.sleep(1)
            driver.execute_script("arguments[0].click();", elemento)
            return True
        except Exception:
            continue
    return False


def clicar_xpath_etiqueta(driver: webdriver.Chrome, xpath_alvo: str, descricao: str) -> bool:
    try:
        elemento = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.XPATH, xpath_alvo)))
        driver.execute_script(
            """
            const el = arguments[0];
            el.scrollIntoView({block: 'center', inline: 'center'});
            const target = el.querySelector('button, input, a, span') || el;
            for (const type of ['mouseover', 'mousedown', 'mouseup', 'click']) {
              target.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, view: window}));
            }
            target.click();
            """,
            elemento,
        )
        time.sleep(1.5)
        log(f"[EMAIL] Etiqueta clicada: {descricao}")
        return True
    except Exception as exc:
        log(f"[EMAIL] Nao consegui clicar na etiqueta {descricao}: {exc}")
        return False


def clicar_etiqueta_checkin_online(driver: webdriver.Chrome) -> None:
    etiquetas = [
        (
            "Check-in Online",
            "/html/body/div[3]/div/main/div[6]/div[2]/guest-detail/div[5]/div[2]/div/fieldset/div[1]/div/ul/li[1]",
        ),
        (
            "Precheck in OK",
            "/html/body/div[3]/div/main/div[6]/div[2]/guest-detail/div[5]/div[2]/div/fieldset/div[1]/div/ul/li[2]/button",
        ),
    ]

    clicou_alguma = False
    for descricao, xpath_alvo in etiquetas:
        if clicar_xpath_etiqueta(driver, xpath_alvo, descricao):
            clicou_alguma = True

    if clicou_alguma:
        return

    raise RuntimeError("Nao foi possivel localizar as etiquetas Check-in Online ou Precheck in OK pelos XPaths informados.")


def salvar_debug_reserva(driver: webdriver.Chrome, num_reserva: str) -> None:
    DEBUG_DIR.mkdir(exist_ok=True)
    try:
        driver.save_screenshot(str(DEBUG_DIR / f"checkin-email-{num_reserva}.png"))
        (DEBUG_DIR / f"checkin-email-{num_reserva}.html").write_text(driver.page_source, encoding="utf-8")
    except Exception:
        pass


def modal_cadastros_similares_aberto(driver: webdriver.Chrome) -> bool:
    try:
        return any(
            el.is_displayed()
            for el in driver.find_elements(By.XPATH, "//modal-guest-registration-similarities")
        )
    except Exception:
        return False


def selecionar_cadastro_similar_se_bater(driver: webdriver.Chrome, nome_email: str | None, cpf_email: str | None) -> bool:
    linhas = driver.find_elements(
        By.XPATH,
        "/html/body/div[1]/div/div/modal-guest-registration-similarities/div[2]/div[2]/div/table/tbody/tr",
    )
    cpf_alvo = normalizar_documento(cpf_email)

    for linha in linhas:
        try:
            nome_tela = linha.find_element(By.XPATH, "./td[2]").text
            documento_tela = linha.find_element(By.XPATH, "./td[3]").text
            doc_tela_limpo = normalizar_documento(documento_tela)

            bate_nome = nomes_correspondem(nome_email, nome_tela)
            bate_doc = cpf_alvo and doc_tela_limpo and cpf_alvo == doc_tela_limpo
            log(
                "[EMAIL] Cadastro similar encontrado: "
                f"nome='{nome_tela}', documento='{documento_tela}', bate_nome={bate_nome}, bate_doc={bool(bate_doc)}"
            )

            if bate_nome or bate_doc:
                botao = linha.find_element(By.XPATH, "./td[1]/button")
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", botao)
                time.sleep(1)
                driver.execute_script("arguments[0].click();", botao)
                log("[EMAIL] Cadastro similar selecionado.")
                time.sleep(2)
                return True
        except Exception:
            continue

    return False


def cadastrar_contato_por_cpf(driver: webdriver.Chrome, wait: WebDriverWait, cpf_email: str | None) -> bool:
    cpf = normalizar_documento(cpf_email)
    if not cpf:
        log("[EMAIL] Nao ha CPF no e-mail para cadastrar dados do contato.")
        return False

    log("[EMAIL] Nenhum cadastro similar bateu. Cadastrando dados do contato pelo CPF do e-mail...")
    clique_forcado("/html/body/div[1]/div/div/modal-guest-registration-similarities/div[3]/div/button", driver, wait)
    campo_cpf = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "/html/body/div[1]/div/div/modal-entity-check-data-registration/div/div[2]/form/div[1]/div/div/div/div[1]/input")
        )
    )
    campo_cpf.clear()
    campo_cpf.send_keys(cpf)
    clique_forcado("/html/body/div[1]/div/div/modal-entity-check-data-registration/div/div[3]/button[1]", driver, wait)
    time.sleep(3)
    return True


def tratar_modal_cadastros_similares(driver: webdriver.Chrome, wait: WebDriverWait, nome_email: str | None, cpf_email: str | None) -> bool:
    try:
        WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.XPATH, "//modal-guest-registration-similarities"))
        )
    except TimeoutException:
        return False

    if not modal_cadastros_similares_aberto(driver):
        return False

    log("[EMAIL] Modal de cadastros similares detectado.")
    if selecionar_cadastro_similar_se_bater(driver, nome_email, cpf_email):
        return True
    return cadastrar_contato_por_cpf(driver, wait, cpf_email)


def tratar_modal_consulta_cpf(driver: webdriver.Chrome, wait: WebDriverWait, cpf_email: str | None) -> bool:
    try:
        WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.XPATH, "//modal-entity-check-data-registration"))
        )
    except TimeoutException:
        return False

    cpf = normalizar_documento(cpf_email)
    log("[EMAIL] Modal Consulta CPF detectado.")

    if not cpf:
        raise RuntimeError("Modal Consulta CPF aberto, mas o CPF/Numero do hospede nao foi encontrado no e-mail.")

    log("[EMAIL] Informando CPF/Numero do e-mail no modal Consulta CPF...")
    campo_cpf = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "/html/body/div[1]/div/div/modal-entity-check-data-registration/div/div[2]/form/div[1]/div/div/div/div[1]/input")
        )
    )
    campo_cpf.clear()
    campo_cpf.send_keys(cpf)
    clique_forcado("/html/body/div[1]/div/div/modal-entity-check-data-registration/div/div[3]/button[1]", driver, wait)
    WebDriverWait(driver, 10).until(
        EC.invisibility_of_element_located((By.XPATH, "//modal-entity-check-data-registration"))
    )
    return True


def clicar_atualizar_cadastro_completo(driver: webdriver.Chrome, wait: WebDriverWait, nome_email: str | None, cpf_email: str | None) -> None:
    xpaths_cadastro = [
        "//button[@ng-click='openEditGuest(entity)']",
        "//button[@title='Atualizar cadastro completo']",
        "//button[@one-tltranslate='btnUpdateFullRegistration']",
    ]

    for tentativa in range(1, 4):
        log(f"[EMAIL] Abrindo cadastro completo... tentativa {tentativa}/3")
        if not clicar_primeiro_possivel(driver, xpaths_cadastro, timeout=8):
            raise RuntimeError("Falha ao encontrar o botao 'Atualizar cadastro completo'.")

        time.sleep(3)
        if tratar_modal_cadastros_similares(driver, wait, nome_email, cpf_email):
            log("[EMAIL] Cadastro similar/CPF tratado. Tentando abrir cadastro completo novamente...")
            time.sleep(3)
            continue

        if tratar_modal_consulta_cpf(driver, wait, cpf_email):
            log("[EMAIL] Consulta CPF tratada. Tentando abrir cadastro completo novamente...")
            time.sleep(3)
            continue

        return

    raise RuntimeError("Nao foi possivel chegar ao cadastro completo apos tratar cadastros similares.")


def criar_driver() -> webdriver.Chrome:
    options = Options()
    if env_bool("ROBOT_HEADLESS", True):
        options.add_argument("--headless=new")
    else:
        options.add_argument("--start-maximized")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)


def fazer_login(driver: webdriver.Chrome, wait: WebDriverWait) -> None:
    log("[EMAIL] Fazendo login no HITS...")
    driver.get(env("HITS_LOGIN_URL", DEFAULT_HITS_LOGIN_URL))
    wait.until(EC.presence_of_element_located((By.NAME, "Email"))).send_keys(required_env("HITS_USER", "HITS_EMAIL"))
    driver.find_element(By.NAME, "Password").send_keys(required_env("HITS_PASSWORD"))
    clique_forcado('//*[@id="navbar-login"]/section/form/div[1]/div[3]/div/button', driver, wait)
    time.sleep(8)


def navegar_para_reservas(driver: webdriver.Chrome, wait: WebDriverWait) -> None:
    log("[EMAIL] Navegando para a tela de reservas...")
    clique_forcado('//*[@id="menuPrimary"]/a', driver, wait)
    time.sleep(2)
    clique_forcado('//*[@id="menureservation"]', driver, wait)
    time.sleep(2)
    clique_forcado('//*[@id="menureservations"]/a', driver, wait)
    time.sleep(4)


def anexar_no_hits(
    driver: webdriver.Chrome,
    wait: WebDriverWait,
    num_reserva: str,
    pasta_arquivos: Path,
    nome_email: str | None = None,
    cpf_email: str | None = None,
):
    log(f"[EMAIL] Processando reserva {num_reserva}")
    try:
        log(f"[EMAIL] Buscando voucher {num_reserva}...")
        time.sleep(3)
        clique_forcado('//*[@id="one-search-filters-container"]/div[1]/button[3]/em', driver, wait)
        clique_forcado('//*[@id="one-search-filters-container"]/div[2]/span[5]/one-translate', driver, wait)

        campo_input = wait.until(EC.visibility_of_element_located((By.XPATH, '//*[@id="one-search-modal-content"]/div/input')))
        campo_input.clear()
        campo_input.send_keys(num_reserva)
        clique_forcado('/html/body/div[1]/div/div/div[4]/button', driver, wait)

        log("[EMAIL] Abrindo reserva...")
        time.sleep(5)
        sucesso_clique = False
        xpaths_tentativa = [
            "(//div[contains(@class, 'ui-grid-row')])[1]//a[1]",
            "(//div[contains(@id, '-uiGrid-')]//div/div/div[1]/a[1])[1]",
            "(//div[contains(@class, 'ui-grid-cell-contents')]//a)[1]",
            "//a[.//i[contains(@class, 'fa-pencil') or contains(@class, 'fa-edit') or contains(@class, 'edit')]]",
        ]
        for xp in xpaths_tentativa:
            try:
                elemento_tabela = WebDriverWait(driver, 3).until(EC.presence_of_element_located((By.XPATH, xp)))
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elemento_tabela)
                time.sleep(1)
                driver.execute_script("arguments[0].click();", elemento_tabela)
                sucesso_clique = True
                break
            except Exception:
                continue

        if not sucesso_clique:
            log("[EMAIL] Reserva nao encontrada na lista.")
            return "NAO_ENCONTRADO"

        log("[EMAIL] Abrindo painel de anexos...")
        time.sleep(6)
        clique_forcado('//*[@id="reservations"]/div[3]/reservation-edit/div[14]/button[7]', driver, wait)

        log("[EMAIL] Verificando anexos existentes...")
        time.sleep(3)
        arquivos_existentes = driver.find_elements(
            By.XPATH,
            "//reservation-attachment-component//div[contains(@class, 'ui-grid-row')]"
            " | //reservation-attachment-component//button[contains(@ng-click, 'delete')]"
            " | //reservation-attachment-component//button[@title='Excluir']",
        )

        if arquivos_existentes:
            log("[EMAIL] Documentos ja encontrados. Pulando upload para evitar duplicidade.")
            time.sleep(1)
            clique_forcado('//*[@id="reservations"]/div[3]/reservation-attachment-component/div/div[4]/button[2]', driver, wait)
        else:
            log("[EMAIL] Nenhum anexo encontrado. Enviando documentos baixados...")
            time.sleep(1)
            input_file = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='file']")))

            arquivos_para_upload = [
                item for item in pasta_arquivos.iterdir()
                if item.is_file() and item.name.lower() != "desktop.ini" and not item.name.startswith(".")
            ]
            if not arquivos_para_upload:
                log("[EMAIL] Nenhum arquivo valido para upload nesta reserva.")

            for arquivo in arquivos_para_upload:
                input_file.send_keys(str(arquivo.resolve()))
                log(f"[EMAIL] Arquivo carregado: {arquivo.name}")
                time.sleep(2)

            log("[EMAIL] Confirmando upload dos anexos...")
            time.sleep(4)
            sucesso_confirmar = False
            xpaths_confirmar = [
                "//button[@ng-click='send()' and @title='Anexar']",
                "//button[contains(@class, 'btn-add') and contains(., 'Anexar')]",
                "//button[@ng-click='send()']",
            ]
            for xp in xpaths_confirmar:
                try:
                    btn_confirmar = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, xp)))
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn_confirmar)
                    time.sleep(1)
                    driver.execute_script("arguments[0].click();", btn_confirmar)
                    log("[EMAIL] Upload confirmado.")
                    sucesso_confirmar = True
                    break
                except Exception:
                    continue

            if not sucesso_confirmar:
                raise RuntimeError("Nao foi possivel encontrar o botao de Anexar/Confirmar final.")

            time.sleep(3)
            clique_forcado('//*[@id="reservations"]/div[3]/reservation-attachment-component/div/div[4]/button[2]', driver, wait)

        log("[EMAIL] Clicando no hospede principal...")
        time.sleep(3)
        clique_forcado("(//button[@ng-click='newGuest(true,guest)' or @title='Atualizar cadastro do hospede'])[1]", driver, wait)

        clicar_atualizar_cadastro_completo(driver, wait, nome_email, cpf_email)

        log("[EMAIL] Selecionando etiqueta Check-in Online...")
        clicar_etiqueta_checkin_online(driver)

        log("[EMAIL] Confirmando dados do hospede...")
        time.sleep(1)
        clique_forcado('//*[@id="guests"]/div[2]/guest-detail/div[9]/div/div/button[1]', driver, wait)

        log("[EMAIL] Confirmando modal...")
        time.sleep(2)
        clique_forcado('/html/body/div[1]/div/div/modal-reservation-add-new-guest/div[3]/button[1]', driver, wait)

        log("[EMAIL] Fechando reserva...")
        time.sleep(2)
        clique_forcado('//*[@id="cancelReservation"]', driver, wait)

        log(f"[EMAIL] Reserva {num_reserva} concluida.")
        time.sleep(4)
        return True

    except Exception as exc:
        log(f"[EMAIL] Erro na reserva {num_reserva}: {exc}")
        salvar_debug_reserva(driver, num_reserva)
        return False


def baixar_anexos(service, message_id: str, payload: dict[str, Any], pasta: Path) -> int:
    pasta.mkdir(parents=True, exist_ok=True)
    total = 0
    for part in iterar_anexos(payload):
        filename = part.get("filename")
        if not filename or filename.lower() == "desktop.ini" or filename.startswith("."):
            continue

        body = part.get("body", {})
        att_id = body.get("attachmentId")
        if att_id:
            data = service.users().messages().attachments().get(userId="me", messageId=message_id, id=att_id).execute()["data"]
        else:
            data = body.get("data", "")

        if data:
            (pasta / filename).write_bytes(base64.urlsafe_b64decode(data.encode("utf-8")))
            total += 1
    return total


def excluir_emails_overbooking(service) -> int:
    query = env(
        "OVERBOOKING_DELETE_QUERY",
        'from:hotel-info@apphotel.one subject:"Vilage Inn All Inclusive Poços de Caldas - Overbooking - Gestor De Canais"',
    )
    limite = int(env("OVERBOOKING_DELETE_LIMIT", "100"))
    excluidos = 0
    page_token = None

    while excluidos < limite:
        request = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=min(100, limite - excluidos),
            pageToken=page_token,
        )
        response = request.execute()
        messages = response.get("messages", [])
        if not messages:
            break

        for message in messages:
            service.users().messages().delete(userId="me", id=message["id"]).execute()
            excluidos += 1

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    if excluidos:
        log(f"[EMAIL] Avisos de overbooking excluidos permanentemente: {excluidos}.")
    else:
        log("[EMAIL] Nenhum aviso de overbooking encontrado para exclusao permanente.")
    return excluidos


def processar_lote_email() -> None:
    log("[EMAIL] Robo iniciado em modo de execucao unica.")
    service = autenticar_gmail()
    excluir_emails_overbooking(service)

    hoje = date.today()
    query = env("CHECKIN_EMAIL_QUERY", "from:no-reply@mobile.nonius.cloud -in:trash")
    max_emails = int(env("CHECKIN_MAX_EMAILS", "30"))

    log("[EMAIL] Checando caixa de entrada do Gmail...")
    results = service.users().messages().list(userId="me", q=query, maxResults=max_emails).execute()
    messages = results.get("messages", [])

    if not messages:
        log("[EMAIL] Nenhum check-in novo encontrado.")
        return

    log(f"[EMAIL] Encontrados {len(messages)} e-mail(s).")
    driver = None
    wait = None
    processados = 0

    try:
        for message in messages:
            msg = service.users().messages().get(userId="me", id=message["id"]).execute()
            payload = msg.get("payload", {})
            texto_email = extrair_texto_completo_email(payload) or msg.get("snippet", "")

            num_reserva = extrair_numero_reserva(texto_email)
            data_checkin = extrair_data_checkin(texto_email)
            cpf_email = extrair_cpf(texto_email)
            nome_email = extrair_nome_hospede_email(texto_email)

            if data_checkin and data_checkin < hoje:
                log(f"[EMAIL] Reserva {num_reserva}: check-in passado ({data_checkin:%d/%m/%Y}). Movendo para lixeira.")
                service.users().messages().trash(userId="me", id=message["id"]).execute()
                continue

            if not num_reserva:
                log("[EMAIL] E-mail sem numero de reserva. Mantendo na caixa para revisao.")
                continue

            if not data_checkin:
                log(f"[EMAIL] Reserva {num_reserva}: data nao identificada. Processando por precaucao.")
            if nome_email or cpf_email:
                log(f"[EMAIL] Reserva {num_reserva}: nome_email='{nome_email or ''}', cpf_email='{cpf_email or ''}'.")

            if driver is None:
                log("[EMAIL] Abrindo Chrome...")
                driver = criar_driver()
                wait = WebDriverWait(driver, int(env("HITS_WAIT_SECONDS", "40")))
                fazer_login(driver, wait)
                navegar_para_reservas(driver, wait)

            pasta = DOWNLOADS_DIR / num_reserva
            total_anexos = baixar_anexos(service, message["id"], payload, pasta)
            log(f"[EMAIL] Reserva {num_reserva}: {total_anexos} anexo(s) baixado(s).")

            status_hits = anexar_no_hits(driver, wait, num_reserva, pasta, nome_email, cpf_email)
            if status_hits is True or status_hits == "NAO_ENCONTRADO":
                log(f"[EMAIL] Movendo e-mail da reserva {num_reserva} para a lixeira para evitar duplicidade.")
                service.users().messages().trash(userId="me", id=message["id"]).execute()
                processados += 1

    finally:
        if driver is not None:
            log("[EMAIL] Fechando navegador.")
            driver.quit()

    log(f"[EMAIL] Processo finalizado. E-mails tratados: {processados}.")


def main() -> None:
    load_dotenv(BASE_DIR / ".env")
    DEBUG_DIR.mkdir(exist_ok=True)
    try:
        processar_lote_email()
    except Exception:
        log("[EMAIL] Erro geral:")
        log(traceback.format_exc())
        raise


if __name__ == "__main__":
    main()
