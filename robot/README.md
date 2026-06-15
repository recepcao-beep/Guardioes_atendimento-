# Robo de conciliacao MyHotel

Este robo compara convites pendentes do app Guardioes com avaliacoes lidas no MyHotel.
Quando encontra o mesmo nome no mesmo canal (`google` ou `tripadvisor`), ele cria a confirmacao externa e muda o convite para `externally_reconciled`.

## Instalar

```powershell
cd "C:\Users\Guilherme\Documents\Automatizações\Guardioes_atendimento-"
cd robot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Edite o arquivo `.env` com:

- `MYHOTEL_USER`
- `MYHOTEL_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

O `.env` nao deve ir para o Git.

## Rodar em teste

```powershell
python .\myhotel_reconciliation_robot.py
```

Nesse modo ele apenas mostra os matches encontrados.

## Confirmar de verdade

```powershell
python .\myhotel_reconciliation_robot.py --confirm
```

Tambem e possivel deixar `ROBOT_DRY_RUN="false"` no `.env`.

## Rodar pelo GitHub Actions

O workflow fica em `.github/workflows/myhotel-reconciliation-robot.yml` e pode ser disparado manualmente pelo GitHub ou pelo botao "Rodar robo na nuvem" dentro do app.

Configure estes secrets no GitHub Actions:

- `MYHOTEL_USER`
- `MYHOTEL_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Configure estas variaveis no Vercel para o botao do app disparar o workflow:

- `GITHUB_ACTIONS_TOKEN`
- `GITHUB_ACTIONS_OWNER`
- `GITHUB_ACTIONS_REPO`
- `GITHUB_ACTIONS_WORKFLOW_ID`
- `GITHUB_ACTIONS_REF`

O token do GitHub precisa ter permissao para disparar workflows neste repositorio.

## Observacoes

- Se o MyHotel nao mostrar o texto Google/Trip dentro do card, mantenha `MYHOTEL_REQUIRE_SOURCE_MATCH="false"` somente apos validar visualmente que a lista aberta ja esta filtrada no canal certo.
- O match de nome ignora acentos, maiusculas/minusculas e pontuacao.
- Se o hospede usar um nome publico diferente, edite o nome no convite do app antes de rodar o robo.
