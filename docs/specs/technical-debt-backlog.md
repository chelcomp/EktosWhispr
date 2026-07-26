# Technical Debt Backlog

**Status**: Draft
**Owner**: @m.martins
**Last Updated**: 2026-07-26

## Overview
Consolidação de pendências técnicas de specs existentes e branches em andamento. **Todas as specs listadas abaixo foram movidas para este backlog e serão removidas após validação.**

---

## Backlog

### 1. Critical (Blockers)
| ID  | Spec Original               | Descrição                                                                                     | Prioridade | Branch/Commit               | Status       | Ações Pendentes                                                                                     |
|-----|-----------------------------|---------------------------------------------------------------------------------------------|------------|-----------------------------|--------------|------------------------------------------------------------------------------------------------------|
| CR-1 | `fix/failing-tests`         | Testes quebrados bloqueiam CI/CD.                                                          | Crítica    | `fix/failing-tests`         | Pendente     | 1. Analisar logs de falha (`npm test`).
2. Corrigir testes unitários/integração.
3. Validar com `pr-reviewer`. |

---

### 2. High Impact
| ID  | Spec Original               | Descrição                                                                                     | Prioridade | Branch/Commit               | Status       | Ações Pendentes                                                                                     |
|-----|-----------------------------|---------------------------------------------------------------------------------------------|------------|-----------------------------|--------------|------------------------------------------------------------------------------------------------------|
| HI-1 | `dynamic-prompt-vocabulary` | Mineração de vocabulário dinâmico para Whisper (últimas 20 transcrições).                  | Alta       | `worktree-dynamic-prompt-vocabulary` | Pendente     | 1. Implementar mineração de vocabulário.
2. Adicionar cache e warmup (`_dynamicVocabPromptCache`).
3. Integrar com pipeline de transcrição. |
| HI-2 | `llama-server-vram-tuning`  | Tuning dinâmico de VRAM para `llama-server` (GPU).                                          | Alta       | `worktree-llama-server-vram-tuning` | Pendente     | 1. Detectar VRAM disponível (via `nvidia-smi`).
2. Ajustar `n_gpu_layers` e `ctx_size` automaticamente.
3. Fallback para CPU se VRAM insuficiente. |

---

### 3. Medium Impact
| ID  | Spec Original               | Descrição                                                                                     | Prioridade | Branch/Commit               | Status       | Ações Pendentes                                                                                     |
|-----|-----------------------------|---------------------------------------------------------------------------------------------|------------|-----------------------------|--------------|------------------------------------------------------------------------------------------------------|
| MI-1 | `renderer-debug-log-level`  | Controle de nível de log no renderer (debug/info/warn/error).                              | Média      | `worktree-renderer-debug-log-level` | Pendente     | 1. Implementar seletor de nível de log na UI.
2. Integrar com `electron-log`.
3. Persistir configuração entre sessões. |
| MI-2 | `dictation-language-detection-fix` | Fallback para idioma padrão (inglês) se detecção falhar.                                   | Média      | `worktree-dictation-language-detection-fix` | Pendente     | 1. Adicionar fallback para `en-US`.
2. Implementar aviso visual para mismatch de idioma.
3. Validar consistência com modelo carregado. |

---

### 4. Low Impact
| ID  | Spec Original               | Descrição                                                                                     | Prioridade | Branch/Commit               | Status       | Ações Pendentes                                                                                     |
|-----|-----------------------------|---------------------------------------------------------------------------------------------|------------|-----------------------------|--------------|------------------------------------------------------------------------------------------------------|
| LI-1 | `build-version-badge`       | Exibir badge de versão na UI (rodapé da janela de configurações).                          | Baixa      | `worktree-build-version-badge` | Pendente     | 1. Adicionar componente de badge na UI.
2. Integrar com `package.json` (versão).
3. Testar exibição em builds locais. |

---

## Detalhes por Pendência

### CR-1: Fix Failing Tests
**Contexto**: Testes quebrados impedem merges na `main`.
**Impacto**: Bloqueia CI/CD e releases.
**Ações Pendentes**:
1. Executar `npm test` e analisar logs de falha.
2. Corrigir testes unitários/integração (ex: mocks desatualizados).
3. Validar com `pr-reviewer` antes de merge.

**Links**:
- Branch: `fix/failing-tests`
- Commits: [Exemplo](https://github.com/Ektos/Whispr/commits/fix/failing-tests)

---

### HI-1: Dynamic Prompt Vocabulary
**Contexto**: A spec `dynamic-prompt-vocabulary.md` foi parcialmente implementada (apenas `package.json` alterado).
**Impacto**: Melhora precisão da transcrição ao usar vocabulário recente do usuário.
**Ações Pendentes**:
1. Implementar mineração de vocabulário a partir das últimas 20 transcrições.
2. Adicionar cache (`_dynamicVocabPromptCache`) e warmup (`_warmupDynamicVocabularyInner`).
3. Integrar com pipeline de transcrição (Whisper prompt hints).

**Links**:
- Spec original: `docs/specs/dynamic-prompt-vocabulary.md`
- Branch: `worktree-dynamic-prompt-vocabulary`

---

### HI-2: Llama Server VRAM Tuning
**Contexto**: A spec `llama-server-vram-tuning.md` requer tuning dinâmico de VRAM para evitar crashes.
**Impacto**: Evita falhas em GPUs com VRAM limitada.
**Ações Pendentes**:
1. Detectar VRAM disponível via `nvidia-smi` ou APIs de GPU.
2. Ajustar `n_gpu_layers` e `ctx_size` automaticamente.
3. Implementar fallback para CPU com aviso ao usuário.

**Links**:
- Spec original: `docs/specs/llama-server-vram-tuning.md`
- Branch: `worktree-llama-server-vram-tuning`

---

### MI-1: Renderer Debug Log Level
**Contexto**: Falta controle granular de logs no renderer (ex: debug/info/warn/error).
**Impacto**: Dificulta debugging de problemas no frontend.
**Ações Pendentes**:
1. Adicionar seletor de nível de log na UI de configurações.
2. Integrar com `electron-log` para persistência.
3. Testar níveis de log em ambiente de desenvolvimento.

**Links**:
- Branch: `worktree-renderer-debug-log-level`

---

## Especificações Obsoletas
As seguintes specs serão **removidas** após validação deste backlog:
- `dynamic-prompt-vocabulary.md`
- `llama-server-vram-tuning.md`
- `dictation-language-detection-fix.md`
- `renderer-debug-log-level.md`
- `build-version-badge.md`

**Nota**: Specs já implementadas (ex: `transcription-preview-window-ready-race.md`) não serão removidas.

---

## Validação
1. **Priorização**: Revisar prioridades com o time (ex: `CR-1` deve ser resolvido antes de `LI-1`).
2. **Implementação**: Cada pendência deve ser tratada como uma task separada, seguindo o fluxo:
   - Criar branch dedicado.
   - Implementar e testar.
   - Validar com `pr-reviewer`.
3. **Atualização**: Marcar pendências como `Implemented` neste backlog após merge na `main`.

---

## Histórico
- **2026-07-26**: Criação do backlog unificado.