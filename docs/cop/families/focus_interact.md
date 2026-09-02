# COP family: Focus / Interact Binding

_Deep-audited ops: `[59]` `[7E]`_

[← COP overview](../index.md) · [$50+ workspace](../../cop_actor_analysis.md)

## Overview

Bind **per-actor focus/interact descriptors** into actor RAM fields consumed by the runtime interact dispatcher (`code_0BE902`) and zone tick scanner (`code_0BF239`). The focus id in `$0676` (written by `[32] set_focus_id`, managed by `[56]`/`[57]` tracked-id ops) gates whether the binding activates at runtime.

Unlike the [tracked_ids](tracked_ids.md) family which manages the global id tables (`$7E4102`/`$7E4192`), this family writes to **per-actor** RAM offsets (`$7F002C`, `$7F002A`, `$7F1036`).

## Shared state

- `$0676` — global focus tracked id (byte); must match `$7F002C` low byte for runtime dispatch to fire
- `$7F002C,X` — focus descriptor word (low byte = focus token, bit 15 = deferred mode flag)
- `$7F002A,X` — param word: numeric variant or script pointer
- `$7F1036,X` — deferred-interact latch (cleared by `[59]`; set by `code_0BE902` when deferred; consumed by `[7E]`)

### Runtime consumers

| Consumer | Location | When |
|----------|----------|------|
| `code_0BE902` | `chunk_0B8000.asm:11260` | Player interacts; `$0676` matches `$7F002C` low byte |
| `code_0BF239` | `chunk_0B8000.asm:12271` | Zone tick; walks active actors, activates focus-bound entities |

#### `code_0BE902` dispatch modes

| `$7F002C` | `$7F002A` | Effect |
|-----------|-----------|--------|
| Negative (bit 15 set) | any | **Deferred:** stores `$7F002A` → `$7F1036` (resume via `[7E]`) |
| Positive | Negative (bit 15 set) | **Immediate redirect:** `STA $28` (set actor resume PC) |
| Positive | Positive (small) | **Numeric variant:** no redirect; handled by zone/entity systems |

## Family notes

- `[59]` is always unconditional — no branches, no JSL. Pure data-binding.
- The copdef condition (`offset 3 & 0x80`) distinguishes `Word, Word` (numeric) from `Word, &Code` (script pointer) at disassembly time, but the handler reads both as plain words.
- Focus token `0x4A` dominates (11 of 12 sites). One site uses `0x53`. Tokens correspond to entity type ids.
- Often paired with `[22] set_interact` and `[44] solid_on` during actor init.
- `[7E]` (`code_00B4DA`) is the natural companion: it checks `$7F1036` (the latch `[59]` clears and `code_0BE902` sets) and resumes from it. See below for deep audit.

## Related ops (not in this family)

| Op | Name | Relationship |
|----|------|-------------|
| `[56]` | `claim_id` | Registers id into global tables; often done before `[59]` binds it |
| `[57]` | `release_id` | Frees id from tables; often done after interaction completes |
| `[5A]` | `branch_if_id_claimed` | Branches if id is in `$7E4102` or matches `$0676` |
| `[5B]` | `branch_if_focus_id` | Branches if operand == `$0676` |
| `[7E]` | `resume_deferred_interact` | Resume from `$7F1036` latch — direct companion to `[59]` deferred mode (now in this family) |
| `[22]` | `set_interact` | Installs interact handler in `$7F0028`; often set alongside `[59]` |
| `[32]` | `set_focus_id` | Writes `$0676` / `$0B70`; prerequisite for `[59]` dispatch at runtime |

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `59` | `set_focus_bind` | 12 | high | Word, Word / Word, &Code | `code_00B4B9` |
| `7E` | `resume_deferred_interact` | 5 | high | (none) | `code_00B4DA` |

**Family call-site total:** 17

## Opcodes

#### COP [59] — `set_focus_bind` (per-actor focus/interact descriptor)

- **Confidence:** high (handler + runtime dispatch `code_0BE902` / `code_0BF239` + all 12 call sites verified)
- **Preferred name:** `set_focus_bind`
- **Aliases:** `bind_focus_interact`, `set_entity_descriptor`
- **Handler:** `code_00B4B9` @ `extracted/system/chunk_008000.asm:7378-7393`
- **Parameters:** `Word`, `Word` — copdef condition: if byte at offset 3 has bit 7 set → `Word`, `&Code`
- **Usage count:** 12

##### What it does

```asm
code_00B4B9 {
    TYX
    LDA [$2C]              ; word 1: descriptor type / focus token
    INC $2C
    INC $2C
    STA $7F002C, X         ; actor field: focus descriptor
    LDA [$2C]              ; word 2: variant or script pointer
    INC $2C
    INC $2C
    STA $7F002A, X         ; actor field: param / callback
    LDA #$0000
    STA $7F1036, X         ; clear deferred-interact latch
    LDA $2C
    STA $02, S
    RTI                    ; always continue
}
```

No JSL, no conditional branches. Writes three actor fields and falls through.

##### Operand patterns (all 12 sites)

| Pattern | Count | Example | Meaning |
|---------|------:|---------|---------|
| `#$004A, #$000N` | 4 | `#$0001`, `#$0002`, `#$0005` | Focus token `0x4A` + numeric variant |
| `#$804A, &code` | 5 | father's house, Stella's house, map_13C | Deferred script when focus = `0x4A` |
| `#$004A, &code` | 2 | `system/actor_0592E1.asm`, `system/actor_059D37.asm` | Immediate interact script |
| `#$0053, #$00EA` | 1 | `map_EC/actor_0894EA.asm` | Focus token `0x53` + param `0xEA` |

##### Why / how used

Typical actor setup — type `#49` interactable with focus binding:

```asm
    ; system/actor_0592E1.asm — focus + immediate interact
    COP [44]                             ; solid_on
    COP [22] ( &code_05931F )            ; set_interact
    COP [59] ( #$004A, &code_059308 )    ; bind focus 0x4A → script
```

```asm
    ; fathers_house/actor_079519.asm — deferred mode
    COP [0B] ( #$804A, &code_07954E )    ; event flag gate
    COP [75] ( #$8183 )                  ; init
    COP [44]
    COP [22] ( &code_0795BA )
    COP [59] ( #$804A, &code_079564 )    ; deferred bind
```

Police-station full lifecycle — claim, bind, release:

```asm
    COP [59] ( #$004A, #$0005 )          ; bind focus 0x4A variant 5
    ; ... cutscene dialog ...
    COP [57] ( #60 )                     ; release tracked ids
    COP [57] ( #61 )
    COP [57] ( #62 )
```

| Item | Value |
|------|-------|
| Suggested alias | `set_focus_bind #type, #variant` or `#type, &script` |
| `$7F002C` low byte | must equal `$0676` at runtime for dispatch to fire |
| `$7F002C` bit 15 | deferred (1) vs immediate (0) interact mode |
| `$7F1036` | cleared on bind; set by interact dispatcher when deferred |

- **Actor RAM:** `$7F002C`, `$7F002A`, `$7F1036`
- **Source examples:**
  - `fathers_house/fathers_house/actor_079519.asm:12` — `#$804A, &code_079564` (deferred)
  - `rococo/stellas_house/actor_05C64D.asm:9` — `#$804A, &code_05C670` (deferred)
  - `system/actor_0592E1.asm:10` — `#$004A, &code_059308` (immediate)
  - `system/actor_059D37.asm:17` — `#$804A, &code_059DAA` (deferred)
  - `rococo/police_station/actor_05CE3A.asm:38` — `#$004A, #$0005` (numeric)
  - `seaside_cave/cave_base_entrance/actor_069061.asm:10` — `#$004A, #$0001` (numeric)
  - `seaside_cave/cave_mystery/actor_068AB9.asm:9` — `#$004A, #$0001` (numeric)
  - `prinkys_mansion/mansion_breaker_entrance/actor_06EA31.asm:12` — `#$004A, #$0002` (numeric)
  - `unorganized/map_13C/actor_0A9972.asm:14` — `#$804A, &code_0A999D` (deferred)
  - `unorganized/map_13C/actor_0A9783.asm:10` — `#$804A, &code_0A97A8` (deferred)
  - `unorganized/map_EC/actor_0894EA.asm:15` — `#$0053, #$00EA` (non-0x4A token)

##### Relationship diagram

```
                    ┌─────────────────────────────────┐
                    │  $7E4102 / $7E4192 (72 slots)  │
                    └──────────────┬──────────────────┘
                                   │
         [58] count free ≥ N ──────┤──── [56] claim id (branch if full)
                                   │
         [57] release id ──────────┤
                                   │
                    ┌──────────────▼──────────────────┐
                    │         $0676 (focus id)        │
                    └──────────────┬──────────────────┘
                                   │
         [59] set $7F002C/$7F002A ─┤──► interact dispatch (0BE902)
                                   │    zone activation   (0BF239)
                                   │
         [5A] branch if id claimed─┤
         [5B] branch if id == $0676│
         [7E] resume from $7F1036──┘
```

---

#### COP [7E] — `resume_deferred_interact` (deferred callback dispatch)

- **Confidence:** high
- **Preferred name:** `resume_deferred_interact`
- **Aliases:** `check_deferred_latch`, `poll_interact_callback`
- **Handler:** `code_00B4DA` @ chunk_008000.asm:7395–7408
- **Parameters:** (none)
- **Usage count:** 5

##### What it does

```asm
code_00B4DA {
    TYX
    LDA $7F1036, X         ; load deferred-interact latch
    BNE loc_00B4E6         ; non-zero → callback pending
    LDA $2C                ; zero → continue script normally
    STA $02, S
    RTI

  loc_00B4E6:
    STA $02, S             ; set return address to latch value
    LDA #$0000
    STA $7F1036, X         ; clear latch (one-shot)
    RTI                    ; jump to callback address
}
```

##### Behavior

1. Read actor-local field `$7F1036,X`
2. If **zero**: no pending callback — continue script at next instruction
3. If **non-zero**: treat the value as a code address, clear the latch, and jump there

This is a **one-shot callback dispatch**: `[59]` clears the latch during actor init, the interact dispatcher `code_0BE902` writes an address into it when the player triggers a deferred interaction, and `[7E]` polls the latch during the actor's main loop.

##### Lifecycle

```
[59] set_focus_bind ( #$804A, &handler )
  → $7F002C = #$804A (deferred, token 0x4A)
  → $7F002A = &handler
  → $7F1036 = 0 (cleared)

... actor runs main loop, polls [7E] each frame ...
    [7E] → $7F1036 == 0 → continue (no-op)

... player triggers interact, code_0BE902 fires ...
    code_0BE902 sees bit 15 in $7F002C → deferred mode
    → writes $7F002A → $7F1036

... next frame, actor polls [7E] again ...
    [7E] → $7F1036 != 0 → jump to &handler, clear latch
```

##### Call site examples

```asm
    ; fathers_house/fathers_house/actor_079519.asm
    COP [59] ( #$804A, &code_079564 )    ; deferred bind
    ...
  code_079534:
    COP [0B] ( #$8001, &code_079564 )
    COP [7E]                              ; poll deferred latch
    COP [63] ( &code_079534 )             ; wait-facing
    COP [28] ( #08, #0B, #14, #14 )       ; wander
    COP [51]
    COP [98]
    COP [52]
    BRA code_079534
```

The actor idles in a wander loop, checking [7E] each iteration. When the player interacts and the focus id matches, `code_0BE902` writes the callback address, and the next [7E] poll dispatches to the handler.

##### All 5 call sites

| Actor | Context |
|-------|---------|
| `fathers_house/fathers_house/actor_079519.asm` | Cat NPC (Dr. Akihabara's cat) |
| `system/actor_059D37.asm` | System actor with deferred focus |
| `rococo/stellas_house/actor_05C64D.asm` | Stella's house NPC |
| `unorganized/map_13C/actor_0A9972.asm` | Map $13C NPC |
| `unorganized/map_13C/actor_0A9783.asm` | Map $13C NPC |
