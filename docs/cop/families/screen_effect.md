# Screen Effect (`[D1]`–`[D4]`)

Four opcodes that start and wait for screen-level visual effects (fades, shakes, scrolls, transitions). All operate on a shared global effect state at `$0BC0`–`$0BC8`. If an effect is already active, the starting ops busy-wait (re-execute on the next tick).

## Overview

| Op | Name | Operands | Velocity | Uses |
|----|------|----------|----------|-----:|
| `D1` | `start_screen_effect` | Byte, Byte, Byte | — | 34 |
| `D2` | `start_screen_effect_vx` | Byte, Byte, Byte, Byte | X (`$0BC6`) | 12 |
| `D3` | `start_screen_effect_vy` | Byte, Byte, Byte, Byte | Y (`$0BC8`) | 21 |
| `D4` | `wait_screen_effect` | (none) | — | 2 |

### Effect state registers

| Address | Role | Set by |
|---------|------|--------|
| `$0BC0` | **Control** — bit 15 = active; bits 0–14 = effect type | D1/D2/D3 write `(byte \| #$8000)`; cleared by engine when effect completes |
| `$0BC2` | **Parameter 1** — effect-specific (e.g., intensity) | D1/D2/D3 |
| `$0BC4` | **Parameter 2** — effect-specific (e.g., duration in frames) | D1/D2/D3 |
| `$0BC6` | **X scroll velocity** — per-frame X offset (from velocity table) | D2 sets via `code_00E398`; D1/D3 clear to 0 |
| `$0BC8` | **Y scroll velocity** — per-frame Y offset (from velocity table) | D3 sets via `code_00E398`; D1/D2 clear to 0 |

### Busy-wait mechanism

All four ops check `$0BC0` on entry:
- If zero (no active effect), the starting ops (D1/D2/D3) initialize the effect and continue.
- If nonzero (effect in progress), the handler backs up `$2C` by 2 bytes (to the COP instruction), saves it as `$28`, and yields. On the next tick, the COP re-executes and re-checks.
- D4 inverts this: continues when `$0BC0 == 0` (done), busy-waits when nonzero.

---

## `[D1]` — `start_screen_effect`

Starts a screen effect with no scroll velocity.

### Handler: `code_00CBB1`

```
TYX
LDA $0BC0 : BNE busy_wait         ; effect active? → re-execute

LDA [$2C] : INC $2C : AND #$00FF
ORA #$8000 : STA $0BC0            ; effect type + active flag
LDA [$2C] : INC $2C : AND #$00FF
STA $0BC2                          ; parameter 1
LDA [$2C] : INC $2C : AND #$00FF
STA $0BC4                          ; parameter 2
STZ $0BC6 : STZ $0BC8             ; clear both velocities
LDA $2C : STA $02,S : RTI         ; continue

busy_wait:
LDA $2C : DEC : DEC : STA $28    ; back up PC to COP instruction
PLA : PLA : RTL                    ; yield (re-execute next tick)
```

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte 1 | 1 | Effect type (0–127, stored with bit 15 set) |
| Byte 2 | 1 | Parameter 1 (effect-specific) |
| Byte 3 | 1 | Parameter 2 (typically duration in frames) |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_0783DB.asm:96` | `COP [D1] ( #00, #00, #01 )` | Father's yard: reset screen effect |
| `actor_07BD34.asm:28` | `COP [D1] ( #00, #00, #0A )` | Inn: screen fade (10 frames) |
| `actor_07BD34.asm:29` | `COP [D1] ( #1B, #00, #05 )` | Inn: effect type 27, 5 frames |
| `actor_06D07D.asm:13` | `COP [D1] ( #17, #01, #01 )` | Library: effect type 23, 1 frame |
| `actor_0AE616.asm:32–35` | `COP [D1]` (×4) | Rapid effect sequence: types 0→2→1→3 |

---

## `[D2]` — `start_screen_effect_vx`

Starts a screen effect with an X scroll velocity.

### Handler: `code_00CBEC`

Same structure as D1, but the 4th byte is passed through `code_00E398` (velocity table lookup from `unk29_list_01C3B9`) and stored to `$0BC6` (X velocity). `$0BC8` (Y velocity) is cleared.

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte 1 | 1 | Effect type |
| Byte 2 | 1 | Parameter 1 |
| Byte 3 | 1 | Parameter 2 |
| Byte 4 | 1 | Velocity table index → X scroll speed |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_0783DB.asm:39` | `COP [D2] ( #06, #02, #01, #02 )` | Father's yard: earthquake X-scroll |
| `actor_078A36.asm:47` | `COP [D2] ( #01, #01, #10, #02 )` | Father's house: shake X, 16 frames |
| `actor_068CFF.asm:39` | `COP [D2] ( #01, #01, #20, #01 )` | Cave prison: shake X, 32 frames |

---

## `[D3]` — `start_screen_effect_vy`

Starts a screen effect with a Y scroll velocity.

### Handler: `code_00CC31`

Same structure as D2, but the velocity goes to `$0BC8` (Y velocity) and `$0BC6` (X velocity) is cleared. The velocity byte is looked up in the same table via `code_00E398`.

### Operands

| Part | Size | Meaning |
|------|------|---------|
| Byte 1 | 1 | Effect type |
| Byte 2 | 1 | Parameter 1 |
| Byte 3 | 1 | Parameter 2 |
| Byte 4 | 1 | Velocity table index → Y scroll speed |

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_0783DB.asm:43` | `COP [D3] ( #05, #01, #01, #02 )` | Father's yard: earthquake Y-scroll |
| `actor_07DFEC.asm:11` | `COP [D3] ( #00, #00, #40, #07 )` | Volcano backdoor: shake Y, 64 frames, speed 7 |
| `actor_069867.asm:35` | `COP [D3] ( #01, #01, #30, #02 )` | Seaside cave: shake Y, 48 frames |
| `actor_098854.asm:24` | `COP [D3] ( #01, #01, #90, #01 )` | Volcano base: shake Y, 144 frames |

---

## `[D4]` — `wait_screen_effect`

Waits (busy-waits) until the current screen effect completes.

### Handler: `code_00CC76`

```
TYX
LDA $0BC0 : BNE busy_wait         ; effect still active?
LDA $2C : STA $02,S : RTI         ; done → continue

busy_wait:
LDA $2C : DEC : DEC : STA $28    ; back up PC
PLA : PLA : RTL                    ; yield (re-check next tick)
```

### Usage (2 sites)

Very rare — most scripts don't need to explicitly wait because the D1/D2/D3 busy-wait handles sequencing automatically. D4 is used when a script needs to ensure a previously-started effect has finished before proceeding.

### Source examples

| File | Call | Context |
|------|------|---------|
| `actor_07D0D7.asm:35` | `COP [D4]` | Elder's hut: wait for screen effect after D2 |
| `actor_0CD67A.asm:61` | `COP [D4]` | Map transition: wait for effect completion |

---

## Usage statistics

| Op | Name | Uses |
|----|------|-----:|
| `D1` | `start_screen_effect` | 34 |
| `D2` | `start_screen_effect_vx` | 12 |
| `D3` | `start_screen_effect_vy` | 21 |
| `D4` | `wait_screen_effect` | 2 |
| | **Total** | **69** |

## Family notes

1. **Global state, not per-actor**: The `$0BC0`–`$0BC8` registers are global WRAM — only one screen effect can be active at a time. The busy-wait mechanism serializes requests: if one actor starts an effect, other actors' D1/D2/D3 calls will block until it completes.

2. **Earthquake pattern**: The most common usage is earthquake/rumble in cutscenes. `actor_0783DB` (father's yard) alternates D2 (X shake) and D3 (Y shake) inside repeat loops to create a sustained earthquake effect. Different velocity indices and durations create varying intensities.

3. **Velocity table reuse**: D2 and D3 use `code_00E398` — the same velocity lookup from `unk29_list_01C3B9` used by the [Animation Setup](anim_setup.md) family. Velocity index `#02` is the most common (12 of 12 D2 calls and 11 of 21 D3 calls).

4. **D4 rarity**: Only 2 call sites use D4. The built-in busy-wait in D1/D2/D3 means most scripts naturally serialize effects. D4 is only needed when native code or a different actor started the effect.

5. **Effect type values**: Observed types range from `#$00` to `#$1B` (0–27). Type `#$00` with small duration appears to be a "reset/clear" effect. Types `#$01`/`#$02` are screen shakes. Higher types (`#$11`, `#$17`, `#$1B`) are likely screen transitions (iris, fade, wipe, etc.).

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Animation Setup](anim_setup.md) `[80]`–`[8C]` | Shares the `code_00E398` velocity lookup table (`unk29_list_01C3B9`) |
| [Script Yield / Resume](script_yield.md) `[CB]`–`[D0]` | D1–D3 use the same busy-wait yield pattern (`DEC $2C; STA $28; PLA; PLA; RTL`); D0 is often used alongside D1 for timing |
