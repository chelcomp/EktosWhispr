# Pending Items (Bugs & Missing Features)

This document tracks known issues, missing features, and work‑in‑progress items discovered while reviewing the EktosWhispr codebase against its specifications (CLAUDE.md, RECREATION_SPEC.md, and the spec catalogue).

## ✅ Confirmed Bugs
*None found – all reported issues have already been addressed in the current codebase.*

## 📌 Missing Features / Future Work

### From **active‑window‑screen‑context** feature (`docs/specs/active-window-screen-context.md`)
1. **macOS / Linux screen capture & OCR** – currently out of scope; marked as future work.
2. **Structured / semantic understanding of OCR text** – future iteration (e.g., detecting code, function names).
3. **In‑app gallery / history view** for persisted screenshots when `persistActiveWindowScreenshots` is enabled.
4. **Manual per‑session capture toggle / hotkey** – a user‑triggered capture in addition to the automatic hotkey‑down trigger.

### From **live‑preview‑VAD‑sensitivity** (`docs/specs/live-preview-vad-sensitivity.md`)
5. **Fine‑tuning of energy‑detector constants** (`energyThreshold`, `minSegmentRms`, `noiseFactor`, `noiseFloorAlpha`, `maxMerges`, `maxMergedMs`) – noted as separate future work if real‑world testing shows a need.

### Draft Specs (awaiting approval / implementation)
6. **llama‑backend‑install‑file‑lock‑fix** (`docs/specs/llama-backend-install-file-lock-fix.md`) – marked **Draft**.
7. **meeting‑tinydiarize‑investigation** (`docs/specs/meeting-tinydiarize-investigation.md`) – marked **Draft** (investigation only; may lead to a follow‑up spec or be declined).

## 📝 Notes
- Items marked as “future work” or “Draft” are **not** currently implemented.
- Once a spec moves from *Draft* → *Approved* → *Implemented*, the corresponding entry should be removed from this list.
- No known bugs remain; the above list reflects only planned enhancements and specifications still under review.