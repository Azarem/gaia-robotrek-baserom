# COP family: Tracked IDs

_Deep-audited ops: `[56]`, `[57]`, `[58]`, `[5A]`, `[5B]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Claim, release, and capacity-check **globally tracked object / NPC ids** in WRAM tables used by world / HUD systems. Adjacent walk ops `[53]`–`[55]` are unrelated; `[59]` (focus/interact binding) uses the same focus id `$0676` but writes per-actor fields, not the shared tables — see [focus_interact.md](focus_interact.md).

## Shared state

- `$05EA` — id staging word/byte for the bank `$08` helpers
- `$0676` — “selected” / focus tracked id (byte). `[57]` clears it when releasing the matching id
- `$7E4102` … — table A, **`$90` bytes** (ids **`≥ #$48`**)
- `$7E4192` … — table B, **`$90` bytes** (ids **`< #$48`**); small ids may be stored as `id | #$0100`
- `code_08EF28` — allocate id into the matching table (CLC = ok, SEC = full)
- `code_08EF7C` — free id from the matching table (CLC = removed, SEC = not found)
- `code_08EFC3` — count empty slots and compare against threshold (CLC = enough, SEC = insufficient)

### Table split

| Id range | Table | Notes |
|----------|-------|-------|
| `#$00`–`#$47` | `$7E4192` | `code_08EF28` may `ORA #$0100` when id `< #$22` |
| `#$48`–`#$FF` | `$7E4102` | Used by most `[56]` / `[57]` call sites (`#4A`…`#6E`) |

Each table is scanned as word slots (`INX INX`) up to `$90` bytes → **72** slots per table.

## Family notes

- `[56]` **branches on failure** (table full → `&Code`); success falls through.
- `[57]` always falls through; side effect is removing the id (and clearing `$0676` if it matched).
- `[58]` **branches on failure** (not enough free slots → `&Code`); success falls through. Always targets table A (`$05EA = #$0048`).
- `[5A]` **branches when found** (id in table A or == `$0676` → `&Code`); not found falls through. Only scans table A.
- `[5B]` **branches when `$0676` matches** (focus id == operand → `&Code`); no match falls through. Does not scan any table.
- Call-site ids often look like unique scenery / NPC instance tokens (quest objects, guests), not plain inventory enums.
- Jump-table neighbors `[55]` (movement), `[59]` (focus/interact binding), and `[5C]`/`[5D]` (currency) are easy false friends.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `56` | `claim_id` | 31 | high | Byte, &Code | `code_00B45D` |
| `57` | `release_id` | 25 | high | Byte | `code_00B476` |
| `58` | `branch_if_slots_below` | 6 | high | Byte, &Code | `code_00B49B` |
| `5A` | `branch_if_id_claimed` | 8 | high | Byte, &Code | `code_00B4F0` |
| `5B` | `branch_if_focus_id` | 73 | high | Byte, &Code | `code_00B51E` |

**Family call-site total:** 143

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

Note: `$0676` is written by `[32] set_focus_id` and read by the interact dispatcher. Releasing the focused id via `[57]` disconnects the NPC from UI focus — scripts that do this typically transition to a non-interactive state immediately after.

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

#### COP [58] — `branch_if_slots_below` (tracked-id capacity pre-check)

- **Confidence:** high (handler + `code_08EFC3` + all 6 call sites verified)
- **Preferred name:** `branch_if_slots_below`
- **Aliases:** `branch_if_id_table_has_room`, `check_tracked_capacity`
- **Handler:** `code_00B49B` @ `extracted/system/chunk_008000.asm:7360-7376`
- **Parameters:** `Byte` threshold, `&Code` on_insufficient
- **Usage count:** 6

##### What it does

```asm
code_00B49B {
    TYX
    LDA #$0048
    STA $05EA              ; force high-id table ($7E4102)
    LDA [$2C]              ; read threshold byte
    INC $2C
    AND #$00FF
    STA $30
    JSL $@code_08EFC3      ; count free slots ≥ threshold?
    BCS insufficient       ; SEC = free_count < threshold
    JMP $&code_009F00      ; enough room → skip &Code
  insufficient:
    LDA [$2C]              ; not enough → goto &Code
    STA $02, S
    RTI
}
```

`code_08EFC3` (`extracted/system/chunk_08D15C.asm:3345-3401`):

1. Selects table based on `$05EA` (`≥ #$48` → table A, `< #$48` → table B). Handler hardcodes `$05EA = #$0048`, so **always checks table A** (`$7E4102`).
2. Counts empty (zero) word slots via loop (`INY` per zero entry, `INX INX` up to `$90`).
3. `free_count ≥ threshold` → **CLC** (success); `free_count < threshold` → **SEC** + sets `$05EA = #$FFFF` (sentinel).

##### Branch polarity

Matches `[56]`: success = fall through, **failure = goto `&Code`**.

##### All 6 call sites

| Threshold | File | Context |
|-----------|------|---------|
| `#03` | `system/actor_05A9DD.asm:229` | Before claiming `#60` / `#61` / `#62` (needs 3 free slots) |
| `#03` | `unorganized/map_16C/actor_08B0BA.asm:60` | Same triple-claim pattern |
| `#01` | `unorganized/map_100/actor_0AD22C.asm:159` | Before single `[56]` claim |
| `#01` | `unorganized/map_166/actor_05B263.asm:32` | Before `[56] #54` |
| `#01` | `unorganized/map_166/actor_05B263.asm:109` | Before `[56]` |
| `#01` | `unorganized/map_ED/actor_089BE8.asm:44` | Before `[56]` |

##### Why / how used

Capacity gate before a batch of `[56]` claims. Prevents partial allocation when multiple ids are needed:

```asm
    ; system/actor_05A9DD.asm — pre-check then triple claim
    COP [58] ( #03, &code_05ABDB )     ; abort if < 3 free slots
    COP [1D] ( &string_05B187 )        ; dialog
    ...
    COP [56] ( #60, &code_05ABDB )
    COP [56] ( #61, &code_05ABDB )
    COP [56] ( #62, &code_05ABDB )
    COP [0A] ( #$8133 )                ; set_flag
```

`&code_05ABDB` is shared by both `[58]` and `[56]` — a "sorry, busy" message handler.

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_slots_below #n, &on_full` |
| Success | fall through (≥ N free slots) |
| Failure | goto `&Code` (< N free slots) |
| Table | always table A (`$7E4102`); `$05EA` hardcoded to `#$0048` |

- **WRAM:** `$05EA` (forced `#$0048`), `$30` (threshold), `$7E4102` (scanned)
- **JSL:** `code_08EFC3`
- **Source examples:**
  - `system/actor_05A9DD.asm:229` — `#03, &code_05ABDB`
  - `unorganized/map_16C/actor_08B0BA.asm:60` — `#03, &code_08B172`
  - `unorganized/map_166/actor_05B263.asm:32` — `#01, &code_05B338`

#### COP [5A] — `branch_if_id_claimed` (test tracked-id table or focus)

- **Confidence:** high (handler verified + all 8 call sites verified)
- **Preferred name:** `branch_if_id_claimed`
- **Aliases:** `branch_if_id_in_table`, `test_tracked_id`
- **Handler:** `code_00B4F0` @ `extracted/system/chunk_008000.asm:7410-7438`
- **Parameters:** `Byte` id, `&Code` on_claimed
- **Usage count:** 8

##### What it does

```asm
code_00B4F0 {
    TYX
    PHX
    LDA [$2C]              ; read id byte
    INC $2C
    AND #$00FF
    SEP #$20               ; 8-bit compare
    CMP $0676              ; focus id match?
    BEQ claimed
    LDX #$0000
  scan:
    CMP $7E4102, X         ; scan table A only
    BEQ claimed
    INX
    INX
    CPX #$0090
    BNE scan
    REP #$20
    PLX
    JMP $&code_009F00      ; not found → skip &Code
  claimed:
    REP #$20
    PLX
    LDA [$2C]              ; found → goto &Code
    STA $02, S
    RTI
}
```

Two-phase test: first against `$0676`, then linear scan of table A (`$7E4102`). Does **not** scan table B.

##### Branch polarity

**Inverted vs `[56]`**: id **found** → goto `&Code`; id **not found** → fall through.

##### Why / how used

Gate actions on whether a tracked id is already claimed:

```asm
    ; map_EC — blimp quest
    COP [5A] ( #53, &code_089552 )    ; already claimed? → skip giving
    COP [56] ( #53, &code_08955D )    ; claim id #53
```

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_id_claimed #id, &on_claimed` |
| Found | goto `&Code` |
| Not found | fall through |
| Tables scanned | `$0676` + `$7E4102` only |

- **WRAM:** `$0676`, `$7E4102`
- **Source examples:**
  - `seaside_cave/actor_0689AB.asm:14` — `#4B`
  - `unorganized/map_EC/actor_0894EA.asm:28` — `#53`
  - `fathers_house/fathers_house/actor_078ACB.asm:99` — `#65`
  - `seaside_cave/cave_storeroom/actor_06A82D.asm:40` — `#68`

#### COP [5B] — `branch_if_focus_id` (test global focus id)

- **Confidence:** high (handler verified + all 73 call sites verified)
- **Preferred name:** `branch_if_focus_id`
- **Aliases:** `branch_if_npc_active`, `test_focus_id`
- **Handler:** `code_00B51E` @ `extracted/system/chunk_008000.asm:7440-7453`
- **Parameters:** `Byte` id, `&Code` on_match
- **Usage count:** 73

##### What it does

```asm
code_00B51E {
    TYX
    LDA [$2C]              ; read id byte
    INC $2C
    AND #$00FF
    CMP $0676              ; compare to focus id
    BEQ match
    JMP $&code_009F00      ; no match → fall through
  match:
    LDA [$2C]              ; match → goto &Code
    STA $02, S
    RTI
}
```

Simpler than `[5A]` — only tests `$0676`, never scans any table.

##### Branch polarity

id **matches `$0676`** → goto `&Code`; **no match** → fall through.

##### Why / how used

The highest-use tracked-id op (73 sites). Scripts test whether a specific NPC is the current focus:

```asm
    ; police_station — paired officer checks
    COP [5B] ( #4D, &code_05CF86 )    ; officer 4D focused → walk away
    COP [5B] ( #4C, &code_05CF86 )    ; officer 4C focused → walk away
    COP [1D] ( &string_05D11E )       ; neither → normal dialog
```

Dominant operand: `#56` (19 uses). Other common: `#4E` (6), `#51` (4), `#4D` (4), `#50` (3).

| Item | Value |
|------|-------|
| Suggested alias | `branch_if_focus_id #id, &on_match` |
| Match | goto `&Code` |
| No match | fall through |
| Tests | `$0676` only |

- **WRAM:** `$0676`
- **Source examples:**
  - `fathers_house/actor_07A684.asm:62` — `#56`
  - `rococo/police_station/actor_05CE3A.asm:155` — `#4D`
  - `system/actor_04BB2E.asm:16` — `#51`
  - `ocean/eatern_hut/actor_0C9D46.asm:78` — `#6E`
