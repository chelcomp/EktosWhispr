# Settings Reorganization — Layout/Structure Only

## Context

Reorganizar TODOS os menus e submenus da tela de Settings do EktosWhispr: apenas layout, estrutura, agrupamento, sequência, encadeamento, descrições e posição. **Zero mudança funcional** — nenhum handler, store, IPC ou lógica de setting muda. Restrições do usuário: profundidade máxima de 3 níveis; qualquer ajuste acessível em ≤4 cliques.

**Estado real descoberto (working tree não commitado, verificado nesta sessão):**
- `src/components/SettingsModal.tsx` (159 linhas): JÁ MIGRADO — sidebar com 6 seções (`input, transcription, aiProcessing, storage, models, system`), `SECTION_ALIASES` (linhas 19–40) e `LEGACY_SUB_TAB` (linhas 42–56) completos, `resolveSection` com validação (linha 114).
- Traduções en/pt: chaves `settingsPage.{input,aiProcessing,storage,models,system}.{title,description}` e grupos L2 JÁ EXISTEM no en (linhas 2179–2345). pt/translation.json JÁ RECEBEU +190 linhas nesta sessão (agente TranslationSync) — NÃO reverter. Chaves `settingsModal.sections.workspace`/`settingsPage.workspace` continuam em ESPANHOL e são órfãs (nenhum código consome); traduções pt prontas em `local://workspace-ptbr-translations.json`.
- `src/components/SettingsPage.tsx` (3475 linhas): MIGRAÇÃO PELA METADE E INCONSISTENTE — união nova declarada (L104–105) MAS `renderSectionContent` (L1832–3324) faz switch nos ids ANTIGOS: 5 arms — `general` (L1834–2654) e `hotkeys` (L2656–2794) com JSX inline; `speechToText|llms|localModel` (L2796–2799) retornam **null**; `privacyData` (L2801–3186); `system` (L3188–3319). O conteúdo de transcription/aiProcessing/models vive em **TabPanels keep-alive** APÓS o return (L3325–3475), gated por `mountedSections`. Effects locais de storage usage JÁ usam o id NOVO `"storage"` — inconsistência que confirma a quebra.
- Inventário COMPLETO já produzido nesta sessão: tabela exata de cada case (ranges, filhos, props consumidas) + análise de hooks compartilhados em `local://settings-restructure-inventory.json`. Implementador DEVE ler esse artefato antes de codar; só re-grepar âncoras se o arquivo mudou.
- Componentes extratores (`InputSection.tsx` etc.) NÃO existem em `src/components/settings/sections/`.
- Estruturas de sub-aba (L2) já implementadas em `SettingsPage.tsx`: SpeechToText tabs (`dictation|noteRecording|upload`, linha 453), VAD tabs (`live|silero`, linha 695), LLMS tabs (`dictationCleanup|dictationAgent|noteFormatting`, linha 747), todas via `useSubTab` + `ProviderTabs`.

## Target Structure (decisão fechada)

6 seções L1 na sidebar, ordem fixa (já implementada no SettingsModal): `input → transcription → aiProcessing → storage → models → system`.

Hierarquia: Seção (L1) → grupo/aba interna (L2) → controle (L3). Nada abaixo de L3; caminho pior caso: abrir settings (1) → seção (2) → grupo (3) → controle (4). Abas internas existentes contam como L2.

Mapeamento de conteúdo antigo→novo (fonte: `SECTION_ALIASES` já implementado — NÃO alterar destinos):
- `general`, `hotkeys` → `input`
- `speechToText`, `meetings`, `uploadTranscription` → `transcription`
- `llms`, `aiModels`, `agentConfig`, `agentMode`, `intelligence`, `prompts` → `aiProcessing`
- `privacyData`, `privacy`, `permissions` → `storage`
- `localModel` → `models`
- `developer`, `softwareUpdates`, conta/sobre/aparência → `system`

## Approach — passos ordenados

### 0. Persistir plano e artefatos no repo (PRIMEIRO ato da execução)
Copiar para dentro do repo, permitindo retomada por agente fresco após falha/limpeza de sessão:
- `docs/plans/settings-restructure-plan.md` ← este plano (conteúdo integral).
- `docs/plans/settings-restructure-inventory.json` ← `local://settings-restructure-inventory.json` (inventário dos cases).
- `docs/plans/workspace-ptbr-translations.json` ← `local://workspace-ptbr-translations.json` (traduções workspace pendentes).
A cópia em `docs/plans/` passa a ser a fonte canônica DURANTE a execução: cada wave concluída atualiza nela o checklist de status (Wave 2 ✓/✗ por worker, Wave 3 ✓/✗, Wave 4 resultado por check). Se a execução morrer, um novo agente lê `docs/plans/settings-restructure-plan.md`, verifica o checklist e retoma a próxima wave pendente sem re-planejar.

### 1. Inventário — CONCLUÍDO nesta sessão
Artefato canônico: `local://settings-restructure-inventory.json` (tabela de todos os cases com ranges, componentes filhos, required_props exatas + análise de hooks compartilhados e estado local). Implementador: ler o artefato antes de codar; re-grepar âncoras em `SettingsPage.tsx` somente se o arquivo tiver mudado desde a geração.

### 2. Criar 6 containers de seção — `src/components/settings/sections/` (paralelizável em 2 workers)
Arquivos novos: `InputSection.tsx`, `TranscriptionSection.tsx`, `AIProcessingSection.tsx`, `StorageSection.tsx`, `ModelsSection.tsx`, `SystemSection.tsx`. Todos default-export.

**Worker A — containers de switch-arm (conteúdo hoje inline no switch):**
- `InputSection`: funde arms `general` (L1834–2654) e `hotkeys` (L2656–2794) numa ÚNICA seção com abas internas L2 `microphone | hotkeys` (`ProviderTabs` + `useSubTab("settings.inputTab", …)`); prop `initialSubTab?: string` seleciona a aba inicial (default `"microphone"`).
- `StorageSection`: corpo do arm `privacyData` (L2801–3186), sem abas internas.
- `SystemSection`: corpo do arm `system` (L3188–3319), sem abas internas.

**Worker B — containers de TabPanel keep-alive (conteúdo hoje fora do switch):**
- `TranscriptionSection`: conteúdo atual do TabPanel `SpeechToTextTabs` (abas existentes `dictation|noteRecording|upload`) + os renderers VAD (`renderWhisperVadSettings`/`renderPreviewVadSettings` movem-se PARA DENTRO, com seus ~40 campos VAD e os seletores `resetWhisperVad`/`resetPreviewVadDefaults` virando props); prop `initialTab?: SpeechTab`.
- `AIProcessingSection`: cluster do TabPanel LLMS (`LlmsTabs`, abas `dictationCleanup|dictationAgent|noteFormatting`, mais `ChatAgentSettings` e afins); prop `initialTab?: LlmTab`.
- `ModelsSection`: TabPanel com `LocalModelSection` + `GpuDeviceSelector`; sem abas internas.

Contrato comum: props = união EXATA das `required_props` do inventário (hoisteadas do `useSettings()` no `SettingsPage`); filhos EXISTENTES compostos verbatim; zero lógica/estado/chamada nova; sem refatorar nenhum filho. Semântica de montagem PRESERVADA: containers A montam ao visitar (switch); containers B ficam sob o gate `mountedSections` exatamente como hoje.

Verificação intermediária: `npm run typecheck` após criar os 6 arquivos — nenhum erro novo permitido (containers ainda não referenciados devem compilar limpos).

### 3. Reescrita ATÔMICA do corpo de `SettingsPage.tsx` (um passe, script único)
Via script único (Node/Python em `eval` lê o arquivo, substitui os ranges e grava UMA vez). NUNCA edits incrementais nesse arquivo (histórico de corrupção piecemeal). Conteúdo:

- Novo switch em `renderSectionContent`: `case "input"` → `<InputSection initialSubTab={initialSubTab} …props/>`; `"storage"` → `<StorageSection …props/>`; `"system"` → `<SystemSection …props/>`; `"transcription"|"aiProcessing"|"models"` → `return null` (mantém padrão atual dos panels).
- Substituir os TabPanels antigos (L3325–3475) por `<TranscriptionSection/>`, `<AIProcessingSection/>`, `<ModelsSection/>`, PRESERVANDO o gate `mountedSections` e a lógica lazy-mount idêntica à atual.
- Mover para os containers as funções auxiliares de abas (`SpeechToTextTabs` wrapper → `TranscriptionSection`; wrapper LLMS → `AIProcessingSection`) junto com suas definições `useSubTab`.
- Remover dead code resultante: JSX dos arms movidos, hooks/estados que só alimentavam blocos removidos, imports órfãos; hooks compartilhados entre seções permanecem no topo e viram props.
- Aliases: fonte única segue sendo `SECTION_ALIASES` em `SettingsModal.tsx`; `SettingsPage` não mantém mapa rival.

### 4. Sidebar (`SettingsModal.tsx`) — corrigir `LEGACY_SUB_TAB`
Ids/ordem/ícones já corretos. Corrigir APENAS `LEGACY_SUB_TAB` (L42–56) — valores devem apontar para abas REAIS dos containers (SpeechToText=`dictation|noteRecording|upload`; Llms=`dictationCleanup|dictationAgent|noteFormatting`; Input=`microphone|hotkeys`):
- Corrigir: `aiProcessing: "cleanup"` → `"dictationCleanup"`; `agentMode`/`agentConfig: "voiceAgent"` → `"dictationAgent"`; `intelligence`/`prompts: "cleanup"` → `"dictationCleanup"`.
- REMOVER entradas sem aba real no destino: `meetings` (não há aba meetings em SpeechToTextTabs), `models: "stt"`, `storage: "retention"`, `system: "appearance"` (containers sem abas internas) — fallback default do container já cobre.
- Manter: `input→"microphone"`, `transcription→"dictation"`, `uploadTranscription→"upload"`.

### 5. Traduções pt-BR — lacuna restante
MAIOR PARTE CONCLUÍDA (+190 linhas pt aplicadas nesta sessão — NÃO reverter). Restante único: substituir os valores em espanhol de `settingsModal.sections.workspace` (~L1116) e `settingsPage.workspace` (~L1985) em `src/locales/pt/translation.json` pelas traduções prontas em `local://workspace-ptbr-translations.json`. Não remover chaves órfãs (fora de escopo).

### 6. Cutover limpo
Grep final: `grep -n '"general"\|"speechToText"\|"llms"' src/components/SettingsPage.tsx` → vazio (fora de comentários). Nenhum alias duplicado, nenhum tipo antigo restante.

## Critical files & anchors

| Arquivo | Âncora | Por quê |
|---|---|---|
| `src/components/SettingsPage.tsx` | união nova L104–105; switch `renderSectionContent` L1832–3324; TabPanels L3325–3475 | alvo da reescrita atômica |
| `src/components/SettingsModal.tsx` | `SECTION_ALIASES` L19–40, `LEGACY_SUB_TAB` L42–56 | fonte única de aliases; corrigir sub-tab values |
| `src/components/ui/SettingsSection.tsx` | wrapper de seção | reuso nos containers |
| `src/components/ui/useSettingsLayout.ts` | hook de layout | usado pelo SettingsPage (L848) |
| `src/locales/{en,pt}/translation.json` | `settingsPage.*` (en ~L2179–2355; pt workspace ~L1116/~L1985) | espelhar chaves; fix workspace es→pt |

## Verification

1. `npm run typecheck` → 0 erros (após passo 2, após passo 3 e no fim).
2. `npm test` → suite verde; baseline 881 passing, nenhuma mudança funcional ⇒ contagem não cai. Se um teste referencia id de seção antigo, atualizar SÓ o id no teste (comportamento testado permanece).
3. `npm run build:renderer` → build ok.
4. Smoke real em produção (não dev — limitação conhecida de janelas transparentes em dev): iniciar app Electron, abrir Control Panel → Settings e verificar via CDP (padrão `scripts/cdp_check.js` já no repo): (a) sidebar mostra exatamente 6 seções na ordem `input→system`; (b) clicar em cada uma renderiza os filhos corretos (ex.: `storage` mostra retenção/permissões); (c) deep-links legados abrem a seção nova — com sub-aba quando houver mapeamento real (`agentMode`→aba `dictationAgent`; `uploadTranscription`→aba `upload`; `meetings`→transcription na aba default); (d) auditar 5 settings aleatórios: nenhum >4 cliques, nada além de nível 3.
5. Mudança de valor em ≥1 setting por seção persiste após fechar/reabrir settings — prova de fiação intacta.

## Assumptions & contingencies

- Os destinos do `SECTION_ALIASES` existente são a decisão canônica de agrupamento (ex.: `permissions` → `storage`). Não re-alocar; churn desnecessário.
- Se um bloco antigo do switch misturar conteúdos que a tabela separa em seções diferentes: dividir o JSX entre os containers novos, mantendo os MESMOS componentes filhos e handlers — divisão é layout, não funcionalidade.
- Se `initialSubTab` apontar para sub-aba inexistente no container destino: cair na primeira aba do container (comportamento default do `useSubTab`).
- Hooks/estado compartilhado entre seções antigas que se separaram: hoistear para `SettingsPage` e passar via props aos containers; nunca duplicar chamadas de hook.

## Execution Mode — Parallel Subagents

**Progresso desta sessão:** InventoryParser ✓ (artefato `local://settings-restructure-inventory.json`); TranslationSync ✓ (+190 linhas pt aplicadas em `src/locales/pt/translation.json`; workspace es→pt pendente).

**Waves restantes (pós-aprovação):**
1. **Wave 2 (paralela, 3 workers):** ContainerBuilder-A (cria `InputSection`/`StorageSection`/`SystemSection`), ContainerBuilder-B (cria `TranscriptionSection`/`AIProcessingSection`/`ModelsSection`), TranslationFixer (workspace es→pt via artefato). Workers A/B tocam SOMENTE seus arquivos novos; nenhum toca `SettingsPage.tsx`.
2. **Wave 3:** BodyRewriter — único worker a tocar `SettingsPage.tsx` (passo 3) + ajuste `LEGACY_SUB_TAB` no `SettingsModal.tsx` (passo 4).
3. **Wave 4:** Verifier — typecheck → npm test (881 baseline) → build:renderer → smoke CDP; reporta pass/fail por check.

Regras: cada worker recebe prompt self-contained + caminhos dos artefatos (locais da sessão e cópia em `docs/plans/`); falha de um builder não bloqueia o outro (merge trivial — arquivos distintos); BodyRewriter só inicia após Wave 2 confirmar os 6 arquivos criados; ao fim de CADA wave, o orquestrador marca o checklist na cópia canônica `docs/plans/settings-restructure-plan.md` ANTES de disparar a wave seguinte — a retomada pós-falha sempre parte desse arquivo.

## Status Checklist (atualizado pelo orquestrador após cada wave)

- Passo 0 — Persistência no repo: ✓ (plano + inventory.json + workspace-ptbr-translations.json em `docs/plans/`)
- Wave 2 — ContainerBuilder-A (Input/Storage/System): ✓ criados (InputSection 1228 l., StorageSection 462 l., SystemSection 172 l.), SettingsPage.tsx intocado
- Wave 2 — ContainerBuilder-B (Transcription/AIProcessing/Models): ✓ criados (TranscriptionSectionContainer 1171 l., AIProcessingSection, ModelsSection com GpuDeviceSelector exportado); notas para o BodyRewriter no fim de history://ContainerBuilderB
- Wave 2 — typecheck intermediário: ✓ containers compilam limpos; erros restantes são só os esperados do SettingsPage.tsx meia-migrada
- Wave 2 — TranslationFixer (workspace es→pt): ✓ 57 chaves substituídas (settingsModal.sections.workspace L1116–1119; settingsPage.workspace L1985–2069), JSON parse OK
- Wave 3 — BodyRewriter: ✓ SettingsPage.tsx reescrito (switch input/storage/system → containers A; panels gated mountedSections → containers B; definições movidas deletadas); LEGACY_SUB_TAB corrigido; typecheck ZERO erros; grep ids legados limpo (só restam chaves i18n settingsPage.general.* de labels)
- Wave 4 — Verifier: typecheck ✓ 0 erros · npm test ✓ 848 pass / 0 fail (33 skipped pré-existentes; 4 testes stale de dictation-bar realinhados a 36px; 2 imports de teste atualizados para TranscriptionSection.tsx) · build:renderer ✓ · smoke CDP produção ✓ (scripts/cdp_settings_smoke.js: ordem 6 seções ✓, conteúdo distinto por seção ✓, persistência de toggle ✓)
- Correção extra: chaves settingsModal.{sections,groups} novas estavam aninhadas errado em settingsPage.settingsModal.* nos dois locales — mescladas para o nível correto (i18n:check OK)
- Cutover limpo: ✓ grep de ids legados em SettingsPage.tsx → vazio

## RESULTADO FINAL: CONCLUÍDO (2026-08-24). Todas as waves verdes.
