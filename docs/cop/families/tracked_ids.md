# COP family: Tracked IDs

_Deep-audited ops: `[56]`, `[57]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Claim and release **globally tracked object / NPC ids** in WRAM tables used by world / HUD systems. Adjacent walk ops `[53]`–`[55]` are unrelated; `[58]`+ (still in the `$50+` workspace) continue this table family.

## Shared state

- `$05EA` — id staging word/byte for the bank `$08` helpers
- `$0676` — “selected” / focus tracked id (byte). `[57]` clears it when releasing the matching id
- `$7E4102` … — table A, **`$90` bytes** (ids **`≥ #$48`**)
- `$7E4192` … — table B, **`$90` bytes** (ids **`< #$48`**); small ids may be stored as `id | #$0100`
- `code_08EF28` — allocate id into the matching table (CLC = ok, SEC = full)
- `code_08EF7C` — free id from the matching table (CLC = removed, SEC = not found)

### Table split

| Id range | Table | Notes |
|----------|-------|-------|
| `#$00`–`#$47` | `$7E4192` | `code_08EF28` may `ORA #$0100` when id `< #$22` |
| `#$48`–`#$FF` | `$7E4102` | Used by most `[56]` / `[57]` call sites (`#4A`…`#6E`) |

Each table is scanned as word slots (`INX INX`) up to `$90` bytes → **72** slots per table.

## Family notes

- `[56]` **branches on failure** (table full → `&Code`); success falls through.
- `[57]` always falls through; side effect is removing the id (and clearing `$0676` if it matched).
- Call-site ids often look like unique scenery / NPC instance tokens (quest objects, guests), not plain inventory enums.
- Jump-table neighbors `[55]` (movement) and `[58]` (related table query — still pending deep audit) are easy false friends.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `56` | `claim_id` | 31 | high | Byte, &Code | `code_00B45D` |
| `57` | `release_id` | 25 | high | Byte | `code_00B476` |

**Family call-site total:** 56

## Opcodes

#### COP [56] — `claim_id` (allocate tracked id; branch if full)

- **Confidence:** high (handler + `code_08EF28` + call sites)
- **Preferred name:** `claim_id`
- **Aliases:** `try_claim_tracked_id`, `alloc_id`, `branch_if_id_table_full`
- **Handler:** `code_00B45D` @ `extracted/system/chunk_008000.asm:7318-7332`
- **Parameters:** `Byte` id, `&Code` on_full
- **Usage count:** 31

##### What it does

```asm
code_00B45D {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $05EA
    JSL $@code_08EF28
    BCS full
    JMP $&code_009F00        ; success → skip &Code (2 bytes)
  full:
    LDA [$2C]
    STA $02, S               ; fail → goto &Code
    RTI
}
```

`code_08EF28` (`extracted/system/chunk_08D15C.asm:3234-3291`):

1. Reads `$05EA`.
2. Picks table A (`≥ #$48`) or B (`< #$48`).
3. Finds a zero word slot; writes the id (with optional `| #$0100` for small B ids).
4. **CLC** = claimed; **SEC** = no free slot.

##### Why / how used

Gate dialog / story beats on successfully registering an instance id; `&Code` is the “cannot claim” path (sometimes a shared busy handler):

```asm
    COP [56] ( #60, &code_05ABDB )
    COP [56] ( #61, &code_05ABDB )
    COP [56] ( #62, &code_05ABDB )
    COP [0A] ( #$8133 )
```

```asm
    COP [56] ( #09, &code_07A3FA )   ; low id → table B
    COP [1D] ( &string_… )
```

Top id literals in source: `#4F` (6), `#4A` / `#60` / `#61` / `#62` / `#58`–`#5A` (2 each).

| Item | Value |
|------|-------|
| Suggested alias | `claim_id #id, &on_full` |
| Success | fall through |
| Failure | goto `&Code` |

- **WRAM:** `$05EA`, `$7E4102` / `$7E4192`
- **JSL:** `code_08EF28`
- **Source examples:**
  - `system/actor_05A9DD.asm:243-245` — `#60` / `#61` / `#62`
  - `fathers_house/farmers_house/actor_07A382.asm:38` — `#09`
  - `volcano_base/shrine_lair/actor_07E936.asm:32` — `#62`

#### COP [57] — `release_id` (free tracked id / clear focus)

- **Confidence:** high
- **Preferred name:** `release_id`
- **Aliases:** `free_tracked_id`, `clear_id`
- **Handler:** `code_00B476` @ `extracted/system/chunk_008000.asm:7334-7356`
- **Parameters:** `Byte` id
- **Usage count:** 25

##### What it does

```asm
code_00B476 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    CMP $0676
    BNE free_table
    STZ $0676                ; releasing the focused id
    BRA done
  free_table:
    STA $05EA
    JSL $@code_08EF7C        ; clear matching slot in A/B table
  done:
    LDA $2C
    STA $02, S
    RTI                      ; always continue
}
```

`code_08EF7C` scans the appropriate table for `$05EA` and writes `0` into the slot (CLC if found, SEC if not). Either way `[57]` continues.

##### Why / how used

Drop a claimed instance when a cutscene / NPC finishes, often right before dialog or flag writes:

```asm
    COP [57] ( #6E )
    COP [1D] ( &string_… )
    LDA #$0100
    TRB $06
```

| Item | Value |
|------|-------|
| Suggested alias | `release_id #id` |
| `$0676` hit | clear focus latch only (no table scan) |
| else | `code_08EF7C` remove from `$7E4102` / `$4192` |

- **WRAM:** `$0676`, `$05EA`, `$7E4102` / `$7E4192`
- **JSL:** `code_08EF7C`
- **Source examples:**
  - `ocean/eatern_hut/actor_0C9D46.asm:84` — `#6E`
  - `system/actor_04BB2E.asm:133` — `#50`
  - `unorganized/actor_09DAF6.asm:52-53` — `#4B`, `#51`
