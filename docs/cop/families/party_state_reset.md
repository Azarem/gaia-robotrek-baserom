# Party State Reset (`[F7]`)

A single system-only opcode that bulk-clears 13 actor RAM fields, resetting a party member to a clean state for a new behavior phase.

## Overview

| Op | Name | Operands | Action | Uses |
|----|------|----------|--------|-----:|
| `F7` | `reset_party_state` | _(none)_ | Clear delay, velocity, follower, and 7 state fields | 6 |

---

## `[F7]` — `reset_party_state`

### Handler: `code_00DACE`

```
TYX
LDA #$0000
STA $000E,X      ; clear delay counter
STA $001C,X      ; clear X velocity
STA $001E,X      ; clear Y velocity
STA $7F1026,X    ; clear follower state
STA $7F1028,X    ; clear follower slot index
STA $7F0020,X    ; clear multipurpose word (chase slot / counter)
STA $7F2002,X    ; clear state field
STA $7F200E,X    ; clear re-execute PC
STA $7F200A,X    ; clear state field
STA $7F2012,X    ; clear state field
STA $7F2014,X    ; clear state field
STA $7F2016,X    ; clear state field
STA $7F2018,X    ; clear state field
LDA $2C : STA $02,S : RTI   ; continue
```

### Fields cleared

| Field | Role | Also used by |
|-------|------|-------------|
| `$0E` (DP) | Delay counter | `[D0]`, `[CD]`, many wait ops |
| `$1C` (DP) | X velocity | `[80]`–`[87]`, `[B4]` |
| `$1E` (DP) | Y velocity | `[80]`–`[87]`, `[B5]` |
| `$7F1026,X` | Follower state | `[2C]`/`[2D]` party follow |
| `$7F1028,X` | Follower slot index | `[2C]`/`[2D]` party follow |
| `$7F0020,X` | Multipurpose word | Chase slot `[2F]`/`[30]`, general counter |
| `$7F2002,X` | State field | Party behavior state |
| `$7F200E,X` | Re-execute PC | `[D7]`/`[D8]` player idle |
| `$7F200A,X` | State field | Party behavior state |
| `$7F2012,X` | State field | Party behavior state |
| `$7F2014,X` | State field | Party behavior state |
| `$7F2016,X` | State field | Party behavior state |
| `$7F2018,X` | State field | Party behavior state |

### Call site patterns

F7 is consistently used at the start of a new party member behavior routine — a "fresh start" before entering a new mode:

```asm
code_03A283:
    COP [F7]                        ; reset all state
    COP [84] ( #2B, #02 )          ; set animation
    COP [98]                        ; wait animation
    COP [AD] ( ... )                ; spawn render child
    ...

code_03B707:
    COP [F7]                        ; reset all state
    COP [89] ( #02 )               ; set facing-dependent animation
    COP [97]                        ; wait animation done
    ...

code_03BB2E:
    LDA #$00B0 : TSB $06           ; set flags
    COP [F7]                        ; reset all state
    ...                             ; setup and render
    COP [B2]                        ; destroy
```

### Source examples

| File | Call | Context |
|------|------|---------|
| `chunk_038000.asm:3910` | `COP [F7]` | Start of party member behavior block |
| `chunk_038000.asm:6421` | `COP [F7]` | Before animation sequence |
| `chunk_038000.asm:6958` | `COP [F7]` | After flags setup, before render |
| `chunk_038000.asm:6977` | `COP [F7]` | Same pattern with Y offset |
| `chunk_038000.asm:6997` | `COP [F7]` | Same pattern, quick destroy |
| `chunk_038000.asm:8880` | `COP [F7]` | Deep in routine, state cleanup |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `F7` | `reset_party_state` | 6 |
| | **Total** | **6** |

## Family notes

1. **System-only**: All 6 call sites are in `chunk_038000.asm` — the main party member behavior engine.

2. **Comprehensive clear**: F7 zeroes 13 separate fields in one instruction, making it significantly more efficient than individual `STZ` operations.

3. **Phase boundary marker**: F7 appears at transitions between party member behavior phases — analogous to a constructor/initializer for the next state.

4. **No operands**: F7 always clears the same set of fields. There's no selective reset capability.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Party Follow](party_follow.md) `[2B]`–`[2E]` | F7 clears `$7F1026`/`$7F1028` (follower state set by `[2C]`/`[2D]`) |
| [Player Idle / Interact](player_idle.md) `[D7]`–`[D9]` | F7 clears `$7F200E` (re-execute PC used by D7/D8) |
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | F7 clears `$1C`/`$1E` (velocity set by animation ops) |
| [Script Yield / Resume](script_yield.md) `[CB]`–`[D0]` | F7 clears `$0E` (delay counter set by D0/CD) |
