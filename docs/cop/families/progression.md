# COP family: Progression (EXP / Level)

_Deep-audited ops: `[60]`, `[61]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

**Experience / level system** — award EXP ("Megs of data"), compute level from EXP thresholds, and branch on level tests. Uses BCD-encoded EXP at `$06DE`/`$06E0` and level at `$0686`, with a level threshold table at `unk32_08D15C`.

## Shared state

### WRAM

| Address | Width | Role |
|---------|------:|------|
| `$06DE` / `$06E0` | 4 bytes | EXP total (BCD), displayed as `[DEC:1,5,06DE]` in menus |
| `$06E2` / `$06E4` | 4 bytes | EXP remaining to next level (BCD), displayed as `NEXT LEV.` |
| `$0686` | 2 bytes | Current player level (computed) |
| `$0688` | 2 bytes | Level-derived stat (from `word_01CBC1` table) |
| `$0B14` | 2 bytes | Display copy of level, shown as `LEVEL [NUM:2,0B14]` |
| `$05EA` | 2 bytes | Scratch: BCD amount for display string |
| `$0879` | 1 byte | SFX queue (value `#$16` = level-up jingle) |
| `$0EEE` | 2 bytes | Player actor slot index |
| `$7F001A,X` | 2 bytes | Actor resume pointer (redirected on level-up) |

### Helpers

| Routine | Purpose |
|---------|---------|
| `code_08EE51` | BCD add to EXP (`$06DE`/`$06E0`) |
| `code_08EEBD` | Recompute level from EXP; updates `$0686`, `$06E2`/`$06E4`, `$0688` |
| `code_049288` | Text display engine |
| `code_list_0BE679` | Mode dispatch table; entry `#$0014/2 = 0xA` = level-up handler |

### Level threshold table

`unk32_08D15C` — array of 4-byte BCD EXP thresholds indexed by level. `code_08EEBD` iterates through the table until EXP < threshold[level+1], determining the current level.

## Family notes

- `[60]` has **0 call sites** — the game awards EXP through the combat engine, not COP scripts. The handler is functional infrastructure that was never used by map scripts.
- `[61]` is exclusively used in **treasure chest** actors (type `#69`, spawn `#80`). Each chest checks a specific level threshold before dispensing its reward.
- Level values in `[61]` operands range from `#01` to `#50` (1–80 decimal), progressing across 35 chests.
- `[61]` takes `[Byte, &Code]`.
- Branch polarity of `[61]`: level ≥ threshold → **goto `&Code`**; level < threshold → fall through.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `60` | `award_exp` | 0 | high | Word | `code_00B5D2` |
| `61` | `branch_if_level_ge` | 35 | high | Byte, &Code | `code_00B61C` |

**Family call-site total:** 35

## Opcodes

#### COP [60] — `award_exp` (add EXP + trigger level-up; unused)

- **Confidence:** high (fully traced despite 0 usage)
- **Preferred name:** `award_exp`
- **Aliases:** `give_megs`, `add_exp_levelup`
- **Handler:** `code_00B5D2` @ `extracted/system/chunk_008000.asm:7542-7578`
- **Parameters:** `Word` (BCD amount, ×16 scaling)
- **Usage count:** 0

##### What it does

```asm
code_00B5D2 {
    TYX
    LDA [$2C]              ; read Word operand
    INC $2C  INC $2C
    ASL : ASL : ASL : ASL  ; ×16
    STA $05EA              ; display amount
    PEI ($06)              ; save actor flags
    LDA #$8800
    TRB $06                ; clear interaction bits
    LDY #$&string_01DA4C   ; "[NAM:0] received [DEC:1,4,5EA] Megs of data!"
    JSL $@code_049288      ; display text
    PLA  STA $06           ; restore flags
    LDA $05EA
    JSL $@code_08EE51      ; BCD add to EXP
    JSL $@code_08EEBD      ; recalculate level
    BCS no_levelup         ; CLC = leveled up
    PHX
    LDX #$0014
    LDA $@code_list_0BE679, X  ; level-up handler address
    LDX $0EEE
    STA $7F001A, X         ; redirect player actor
    PLX
    SEP #$20
    LDA #$16
    STA $0879              ; level-up SFX
    REP #$20
  no_levelup:
    LDA $2C  STA $02,S  RTI
}
```

Always continues after execution. Level-up triggers the player actor redirect and SFX.

##### Display string

`string_01DA4C`: `"[NAM:0] received [DEC:1,4,5EA] Megs of data!"`

The operand is shifted left 4 bits (×16), so a Word value of `#$0001` would display as 16 Megs.

#### COP [61] — `branch_if_level_ge` (test player level)

- **Confidence:** high (handler + all 35 call sites verified)
- **Preferred name:** `branch_if_level_ge`
- **Aliases:** `branch_if_level`, `check_level`
- **Handler:** `code_00B61C` @ `extracted/system/chunk_008000.asm:7580-7594`
- **Parameters:** `Byte` level_threshold, `&Code` on_met
- **Usage count:** 35

##### What it does

```asm
code_00B61C {
    TYX
    LDA [$2C]              ; read threshold byte
    INC $2C
    AND #$00FF
    CMP $0686              ; vs current level
    BEQ match              ; equal → met
    BCC match              ; below level → met
    JMP $&code_009F00      ; above level → not met, skip &Code
  match:
    LDA [$2C]              ; goto &Code
    STA $02, S
    RTI
}
```

##### Branch polarity

| Condition | Outcome |
|-----------|---------|
| Level ≥ threshold | goto `&Code` |
| Level < threshold | fall through |

##### All 35 call sites — threshold distribution

| Range | Decimal | Count |
|-------|--------:|------:|
| `#01`–`#05` | 1–5 | 5 |
| `#06`–`#0E` | 6–14 | 9 |
| `#0F`–`#18` | 15–24 | 10 |
| `#19`–`#1E` | 25–30 | 6 |
| `#28` | 40 | 1 |
| `#32` | 50 | 1 |
| `#3C` | 60 | 1 |
| `#46` | 70 | 1 |
| `#50` | 80 | 1 |

All 35 actors follow the same treasure-chest pattern at line 23 of their respective files.

##### Typical usage

```asm
    ; actor_07A7A8.asm — level-1 treasure chest
    COP [22] ( &interact_handler )
    COP [CC]
    RTL
    ; interact:
    COP [0B] ( #$842D, &already_claimed )
    COP [61] ( #01, &reward )            ; level ≥ 1?
    COP [27] ( #06, &too_low )           ; "not high enough"
```

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_level_ge #threshold, &on_met` |
| Level met | goto `&Code` |
| Level not met | fall through |

- **WRAM:** `$0686`
- **Source examples:**
  - `actor_07A7A8.asm:23` — `#01` (level 1)
  - `actor_07A88F.asm:23` — `#04` (level 4)
  - `unorganized/map_165/actor_07B148.asm:23` — `#3C` (level 60)
  - `unorganized/map_165/actor_07B1E2.asm:23` — `#50` (level 80)

## Relationship diagram

```
  ┌───────────────────────────────────────────────────────────┐
  │                 EXP / Level System                        │
  │                                                           │
  │  $06DE/$06E0 (EXP)  ← code_08EE51 ← [60] award_exp      │
  │       │                                                   │
  │       ▼                                                   │
  │  code_08EEBD ──► $0686 (level) ◄── [61] branch_if_level  │
  │       │              │                                    │
  │       ▼              ▼                                    │
  │  $06E2/$06E4    $0688 (stat)                              │
  │  (next-level)   (from word_01CBC1)                        │
  │                                                           │
  │  Level-up: $7F001A,X → code_list_0BE679[0xA]              │
  │            $0879 = #$16 (SFX)                             │
  └───────────────────────────────────────────────────────────┘
```
