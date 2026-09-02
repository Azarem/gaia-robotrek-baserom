# Combat / Encounter Gate — COP `[71]` `[72]` `[73]`

> Deep-audited ops: `[71]` `[72]` `[73]`

## Overview

Pre-battle setup, in-battle polling, and post-battle result dispatch for scripted enemy encounters. These three opcodes work together with a **battle slot table** (four parallel WRAM arrays at `$7E3E20`–`$7E3ED4`, 30 word slots each) and the `code_03FB43` battle initialization routine. Nearly every boss and overworld enemy actor uses this trio.

Typical call pattern:

```asm
    COP [73] ( param, flag_id, @win_handler, @lose_handler )
    COP [03] ( @code_03FB43 )       ; battle init (common subroutine)
    COP [44]                        ; solid_on
    ...
    COP [72] ( #08 )                ; poll for battle result
    ...                             ; post-battle behavior
```

## Shared state

### Battle slot table

Four parallel arrays, each 30 words (`$003C` bytes). Slot index comes from actor field `$04`.

| Address | Role |
|---------|------|
| `$7E3E20,X` | Saved script PC low (return address for post-battle resume) |
| `$7E3E5C,X` | Saved script PC high / status |
| `$7E3E98,X` | Battle outcome: `0` = pending, `#$FFFF` = destroyed, other = result |
| `$7E3ED4,X` | Ready flag: `0` = battle not complete, non-zero = result available |

Cleared to zero by `code_009B47` (system reset routine, chunk_008000.asm:3619).

### Globals

| Address | Role |
|---------|------|
| `$05C4` | Current battle owner's slot index |
| `$05C8` | Battle system flags — bit `#$4000` = combat active, bit `#$8000` = battle ended |
| `$04` | Actor slot index (direct page, per-actor) |
| `$06` | Actor flags — bit `#$4000` = interaction-busy |

### Helpers

| Label | Role |
|-------|------|
| `code_00E2D2` | Clear collision/solid cells for this actor's footprint (`$7FA000`) |
| `code_04FD4E` | Actor self-destruct (unlink from chain, decrement `$56` actor count) |
| `code_00DC12` | Test story flag (wrapper around `code_00DBEF`) — carry set if flag is set |
| `code_00DC18` | Set story flag (wrapper around `code_00DBBD`) |
| `code_03FB43` | Battle actor initialization — common subroutine called by `COP [03]` after `[73]` |

## Family notes

- **`[73]` is always the first opcode** in an enemy actor's script. It gates whether a battle is needed, has already been won (flag check), or is currently in progress (slot resume).
- **`[72]` appears inside the battle loop**, saving the actor's script position into the slot table and yielding until the battle subsystem signals completion via `$7E3ED4`.
- **`[71]` is a specialized solid-clear + destroy** used by NPCs in scenes that share space with combat encounters (Prinky's Mansion east wing). It checks `$06 bit #$4000` and only fires when combat is active.
- **Operand 2 of `[73]`** encodes a story flag with `#$C0xx` pattern (high bit set = flag id). When the battle is won, the flag is set via `code_00DC18`. On subsequent visits, `code_00DC12` tests the flag and skips the encounter.
- **`$7E3E98,X = #$FFFF`** signals the actor should self-destruct (used for encounters that permanently remove the NPC).
- All 31 call sites for `[72]` use operand `#08` except two (`#00` in `actor_0BF948.asm` and `#01` in `actor_0BFA86.asm`). The byte is consumed to advance the script pointer but not directly used by the handler.
- `actor_0BF77D` is the **battle result writer** — it stores `#$0001` into `$7E3ED4,X` to signal completion to `[72]`.

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[71]` | `combat_solid_gate` | 13 | 2 |
| `[72]` | `combat_result_poll` | 31 | 27 |
| `[73]` | `encounter_gate` | 44 | 35 |
| | **Total** | **88** | |

## Opcodes

---

#### COP [71] — `combat_solid_gate` (clear solids and destroy if combat-busy)

- **Confidence:** high
- **Preferred name:** `combat_solid_gate`
- **Handler:** `code_00BAA3` @ chunk_008000.asm:8261–8280
- **Parameters:** (none)
- **Usage count:** 13

##### What it does

```asm
code_00BAA3 {
    TYX
    LDA $06
    BIT #$4000
    BNE loc_00BAB0        ; interaction-busy → destroy
    LDA $2C
    STA $02, S
    RTI                   ; not busy → continue script

  loc_00BAB0:
    LDA $00
    STA $34
    LDA $02
    STA $36
    JSR $&code_00E2D2     ; clear collision footprint
    JSL $@code_04FD4E     ; destroy actor
    PLA
    PLA
    RTL
}
```

If `$06 bit #$4000` (interaction-busy / combat active) is clear, the script continues normally. If set, the actor clears its collision footprint via `code_00E2D2` and destroys itself via `code_04FD4E`. This prevents NPCs from remaining as solid obstacles during combat.

##### Why / how used

All 13 call sites are in two actors in Prinky's Mansion east wing (`actor_06DC22` foyer, `actor_06DD4C` hallway). The hallway actor uses `[71]` inside repeated animation loops — each iteration checks whether combat has started, and if so, the NPC removes itself from the scene:

```asm
    COP [05] ( #$0004 )       ; repeat 4 times
    COP [82] ( #05, #12 )     ; set anim
    COP [97]                   ; wait anim done
    COP [0F] ( ... &escape )   ; proximity check
    COP [71]                   ; ← if combat active, clear solids + destroy
    COP [06]                   ; repeat_yield
```

---

#### COP [72] — `combat_result_poll` (save slot state; yield until battle done)

- **Confidence:** high
- **Preferred name:** `combat_result_poll`
- **Aliases:** `battle_yield`, `combat_wait`
- **Handler:** `code_00BAC2` @ chunk_008000.asm:8282–8314
- **Parameters:** `Byte` (consumed but not used by handler)
- **Usage count:** 31

##### What it does

```asm
code_00BAC2 {
    LDX $04
    CPX #$003D
  loc_00BAC7:
    BCS loc_00BAC7        ; safety: infinite loop if slot >= 0x3D (should never happen)
    LDA $00
    STA $7E3E20, X        ; save return PC low to slot
    LDA $02
    STA $7E3E5C, X        ; save return PC high to slot
    LDA $7E3ED4, X        ; read ready flag
    TYX
    CMP #$0000
    BNE loc_00BAE6         ; result ready → continue

    LDA $06
    BIT #$4000
    BNE loc_00BAED         ; combat-busy → halt and retry

  loc_00BAE6:              ; continue: skip operand byte
    INC $2C
    LDA $2C
    STA $02, S
    RTI

  loc_00BAED:              ; halt: back up PC to re-execute this COP
    LDA $2C
    DEC
    DEC
    STA $28                ; $28 = resume PC (2 bytes back = this COP instruction)
    PLA
    PLA
    RTL
}
```

1. Validates slot index `$04 < #$3D`
2. Saves the current script return address (`$00`/`$02`) into the battle slot table at `$7E3E20,X` / `$7E3E5C,X`
3. Checks `$7E3ED4,X` — if non-zero, the battle is complete → advance past the operand byte and continue
4. If zero and `$06 bit #$4000` is set: halt, setting `$28` to re-execute this instruction next frame (busy-wait loop)
5. If zero and `$06 bit #$4000` is clear: continue anyway (edge case — battle was interrupted or never started)

##### Operand byte

The 1-byte operand is consumed by `INC $2C` on the continue path. It is **not directly used** by this handler — 29 of 31 call sites pass `#08`. The value may be consumed by the battle subsystem reading the slot table, or may be a reserved field.

##### Why / how used

Placed inside the enemy actor's idle/patrol loop, `[72]` yields execution each frame until the battle system writes a result:

```asm
  loop:
    COP [72] ( #08 )           ; yield until battle result ready
    COP [80] ( #04 )           ; set anim
    COP [97]                   ; wait anim done
    BRA loop
```

The battle result writer (`actor_0BF77D`) stores `#$0001` into `$7E3ED4,X` when the battle concludes, unblocking `[72]`.

---

#### COP [73] — `encounter_gate` (battle flag check / slot setup / result dispatch)

- **Confidence:** high
- **Preferred name:** `encounter_gate`
- **Aliases:** `battle_gate`, `encounter_setup`
- **Handler:** `code_00BB02` @ chunk_008000.asm:8326–8429
- **Parameters:** `Word` param, `Word` flag_id, `@Code` win_handler, `@Code` lose_handler
- **Usage count:** 44

##### Operand layout (10 bytes)

| Offset | Type | Role |
|-------:|------|------|
| 0 | Word | Parameter / index (stored in `$20`; often `#$0000`) |
| 2 | Word | Flag id / condition (`$22`): `#$C0xx` = story flag, `#$0000`/`#$0001` = special |
| 4 | @Code (3 bytes) | Win handler address (far pointer; `$000000` = none) |
| 7 | @Code (3 bytes) | Lose / combat-phase handler address (far pointer; `$000000` = none) |

##### What it does

The handler routes to one of several paths depending on whether the encounter has been won before, is currently in progress, or needs to be started:

**Phase 1 — Route by flag_id:**
- If `flag_id` has bit 15 set (`#$C0xx` pattern) or is zero: check the battle slot table first (Phase 2)
- If `flag_id` is a small positive value (`#$0001`): skip directly to encounter setup (Phase 3)

**Phase 2 — Check saved battle state** (`loc_00BB19`):
- If `$7E3E20,X` (saved PC) is zero: no prior encounter → go to Phase 3
- Otherwise restore saved `$00`/`$02` from slot
- If `$7E3E98,X` (battle outcome) is `#$FFFF`: destroy actor (`code_04FD4E`)
- If `$7E3E98,X` is non-zero: skip to win/lose branch resolution (Phase 5)
- If `$7E3E98,X` is zero: go to Phase 3

**Phase 3 — Encounter setup** (`loc_00BB36`):
- If `$04 != $05C4` (this actor is NOT the current battle owner):
  - If `flag_id` has high bit: test it via `code_00DC12`. If flag is set (battle already won) → destroy actor
  - Skip remaining operands (add 11 to `$2C`) → halt. The actor waits to be activated by the battle system.
- If `$04 == $05C4` (this actor IS the battle owner): go to Phase 4

**Phase 4 — Battle resolution** (`loc_00BB54`):
- If `$05C8 bit #$4000` (combat active): skip win handler, try lose handler
- If not active: set the story flag if `flag_id` has high bit (`code_00DC18`), then try win handler
- If the selected handler pointer is `$000000`: fall through to continue after the operands
- If non-zero: clear `$05C8 bit #$8000` and far-jump to the handler

**Phase 5 — Far jump** (`loc_00BB89`):
Load the 3-byte code pointer from the operand stream and jump to it (modifying RTI return address).

**Phase 6 — Destroy** (`loc_00BBA1`):
Call `code_04FD4E` to destroy the actor.

##### Operand 2 values

| Value | Count | Meaning |
|-------|------:|---------|
| `#$0000` | 15 | No flag — pure slot-based (system combat actors) |
| `#$0001` | 3 | Special: skip slot check, always start encounter setup |
| `#$C0xx` | 26 | Story flag id (unique per encounter) — tested/set to track victory |

##### Why / how used

**Boss encounter** — tests flag, branches to win/lose code:

```asm
    COP [73] ( #$0000, #$C175, @code_win, @code_lose )
    COP [03] ( @code_03FB43 )    ; battle init
    COP [44]                     ; solid_on
    ...idle/patrol loop with COP [72]...
```

On first visit: flag `#$C175` is clear → encounter activates. When combat ends: `code_03FB43` routes back, flag gets set, and the actor either jumps to `@code_win` or `@code_lose`.

On subsequent visits: flag `#$C175` is set → `code_00DC12` returns carry → actor self-destructs.

**System combat actor** (no flag, slot-only):

```asm
    COP [73] ( #$0000, #$0000, $000000, $000000 )
    COP [03] ( @code_03FB43 )
    COP [44]
    ...
```

All four operands are zero — the actor participates in combat purely via slot mechanics without story-flag tracking.

**Mansion tower encounters** (flag gate, no handlers):

```asm
    COP [73] ( #$8200, #$C17B, $000000, $000000 )
```

Operand 1 = `#$8200` (non-zero param used by battle init), flag `#$C17B`, but no win/lose handlers — the battle system handles everything internally.

## Relationship diagram

```
[73] encounter_gate
  ├─ flag already set? → code_04FD4E (destroy actor)
  ├─ not battle owner? → halt, wait for activation
  ├─ battle won? → set flag, jump to @win_handler
  ├─ battle active? → jump to @lose_handler
  └─ slot has #$FFFF result? → code_04FD4E (destroy)

[72] combat_result_poll
  ├─ $7E3ED4,X != 0 → continue script (battle done)
  └─ $7E3ED4,X == 0 + busy → halt, retry next frame
      ↑ actor_0BF77D writes $7E3ED4,X = 1

[71] combat_solid_gate
  ├─ $06 bit #$4000 clear → continue (no combat)
  └─ $06 bit #$4000 set → clear solids + destroy self
```
