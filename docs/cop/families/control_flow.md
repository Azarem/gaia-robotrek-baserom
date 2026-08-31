# COP family: Control flow

_Deep-audited ops: `[00]`, `[01]`, `[02]`, `[03]`, `[04]`, `[05]`, `[06]`, `[07]`, `[09]`, `[27]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Script subroutine call/return, counted repeats, far goto, and player script hijack. These ops move the per-actor script PC (`$2C`/`$2A`) and use return slots in `$7F001A` / `$7F001C`/`$1E` / `$7F0024`.

## Shared state

- `$7F001A,X` — near gosub return; also planted by `[27]` / `[37]`
- `$7F001C,X` / `$7F001E,X` — far gosub return PC / bank
- `$7F0024,X` — **shared** by `[02]` return_main and `[05]`–`[07]` repeat head
- `$7F0026,X` — remaining repeat count
- `$0EEE` — player actor slot; `[27]` targets this slot’s `$7F001A`

## Family notes

- `[09]` (`goto_far`) sits between flag ops in the jump table but is **not** a flag op.
- `[02]` and `[05]`–`[07]` must not own `$7F0024` at the same time — repeat loops reuse the main/idle resume slot.
- `[27]` is control-flow adjacent (plants a near-return on the **player**), not part of wander `[28]`+.
- Near stack is single-level (`$7F001A`); far stack is separate (`$7F001C`/`$1E`). Nesting near calls overwrites the return.
- `[06]` yields between iterations; `[07]` keeps running on the same tick — prefer `[06]` for anim/timing-sensitive loops.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `00` | `gosub` | 143 | high | ptr16 code | `code_00A106` |
| `01` | `return` | 114 | high | (none) | `code_00A116` |
| `02` | `return_main` | 14 | high | (none) | `code_00A12A` |
| `03` | `gosub_far` | 68 | high | ptr24 code | `code_00A131` |
| `04` | `return_far` | 35 | high | (none) | `code_00A154` |
| `05` | `repeat_begin` | 233 | high | u16 | `code_00A174` |
| `06` | `repeat_yield` | 219 | high | (none) | `code_00A188` |
| `07` | `repeat_continue` | 19 | high | (none) | `code_00A1A2` |
| `09` | `goto_far` | 25 | high | ptr24 code | `code_00A1D9` |
| `27` | `queue_player_script` | 167 | high | Byte, &Code | `code_00A793` |

**Family call-site total:** 1037

## Opcodes

#### COP [00] — `gosub` (near script subroutine call)

- **Confidence:** high (handler + call-site audit)
- **Preferred name:** `gosub`
- **Aliases:** `call`, `call_near`, `script_gosub`
- **Handler:** `code_00A106` @ `extracted/system/chunk_008000.asm:4352-4361`
- **Pairs with:** `COP [01]` (`return`) — always; do not confuse with `COP [03]`/`[04]` (far gosub/return)
- **Parameters:** `&Code` — **16-bit same-bank** code pointer (`us/copdef.json`: `["&Code"]`)
- **Usage count:** 143 call sites across 44 files (~half in credits directors)

##### What it does (exact semantics)

When the script engine hits `COP [00]`, handler `code_00A106` runs with `X` = current actor slot:

1. Read the 16-bit target from `[$2C]` and advance `$2C` by 2 (past the operand).
2. **`STA $02,S`** — patch the COP interrupt return PC so `RTI` jumps **into the callee**, not back to the next script byte.
3. **`STA $7F001A,X`** — save the post-operand PC (the instruction *after* this `COP [00]`) as the **single return address** for this actor.
4. **`RTI`** — enter the callee.

So this is a **script-level GOSUB**: transfer control to a reusable routine, remember where to continue, and come back via `COP [01]`.

```asm
; Handler (complete)
code_00A106 {
    TYX
    LDA [$2C]          ; target &Code
    INC $2C
    INC $2C            ; $2C = return site (next opcode after call)
    STA $02, S         ; RTI → callee
    LDA $2C
    STA $7F001A, X     ; save return site
    RTI
}
```

Matching return (`COP [01]`, `code_00A116`):

- If `$7F001A,X ≠ 0`: restore it to `$02,S`, **clear** the slot to 0, `RTI` → resume after the original `gosub`.
- If `$7F001A,X = 0`: `PLA PLA RTL` — no pending gosub; treat as end-of-tick / halt for this actor entry.

##### Why it exists (design rationale)

Native `JSR`/`RTL` are **not** what scripts use for shared logic, because actor code is driven through the COP interrupt frame (`code_009EE8`) and cooperative yields (`RTL` ending an actor tick, delays, anim waits, etc.). `gosub` gives scripts:

1. **Same-bank code reuse** without duplicating multi-instruction sequences (credits helpers, mansion FX, cutscene blinks).
2. **A return that survives yields** — `$7F001A,X` is actor WRAM, not the CPU stack. A callee may `RTL` mid-routine (end the tick); on a later tick the actor can resume inside that callee; only `COP [01]` clears the return slot and resumes the caller.
3. **Contrast with `JMP $&label` / `BRA`** — those do not come back.
4. **Contrast with `COP [03]` (`call_far`)** — far variant also saves bank in `$7F001E,X` and uses `$7F001C,X`; `[00]` is the cheap near form when callee is in the same bank as the caller.

##### Critical constraint: one level only

`$7F001A,X` is a **single word**, not a stack. A nested `COP [00]` inside an active gosub **overwrites** the outer return address (lost). Audited callees of `[00]` do **not** themselves contain `COP [00]` — nesting is avoided in shipped scripts. For multi-level needs, authors flatten sequences or use far-call / other control flow.

Other opcodes also **write** `$7F001A,X` (`COP [27]` queues a player resume vector from `code_list_0BE679`; `COP [37]` stores a loop target). Those are related consumers of the same slot, not aliases of `gosub`.

##### How it is used in source (patterns)

**Pattern A — Shared cutscene helpers (credits, dominant use)**  
Class `#68` directors repeatedly gosub into `extracted/credits/credit_functions.asm`:

| Target | Role | Ends with |
|--------|------|-----------|
| `code_04CDFB` | Spawn credit UI actor, fade/setup, first string | `COP [01]` |
| `code_04CE37` | Emit next credit-table line + IRQ hook; `INC $20` | `COP [01]` |
| `code_04CE2E` | Multi-frame **wait**: `STZ $20`, poll until `$20≠0`, else `RTL` | falls into CE37 / returns via its `[01]` |
| `code_04CE89` | Same wait pattern, then explicit `COP [01]` | `COP [01]` |
| `code_04CE94` | Short IRQ pulse helper | `COP [01]` |

Example (`credits/credits_festival/actor_04C9A3.asm`):

```asm
COP [00] ( &code_04CDFB )    ; gosub setup
COP [68] ( #00, #00, #F0, #11 )
COP [00] ( &code_04CE37 )    ; gosub show one credit line
COP [D0] ( #$00F0 )
COP [05] ( #$0002 )
COP [00] ( &code_04CE2E )    ; gosub wait (may span frames via RTL)
COP [D0] ( #$0168 )
COP [07]
COP [00] ( &code_04CE89 )    ; gosub wait-then-return
```

This is why `[00]` exists: every credits scene shares the same helpers instead of inlining ~20–60 instructions.

**Pattern B — Local NPC/cutscene subroutine**  
Same actor file defines a helper that performs a fixed beat, then `COP [01]`. Callers gosub it from multiple branches.

Example: Carl finding the Litho (`seaside_cave/cave_storeroom/actor_06A82D.asm`) — two approach paths both:

```asm
COP [00] ( &code_06A924 )   ; shared “found Litho” dialog/anim beat
COP [80] ( #02 )            ; continue path-specific walk-off
...
```

Callee:

```asm
code_06A924 {
    COP [4D] ( #00, #$FFFF )
    COP [41] ( #0D )
    COP [80] ( #0D )
    COP [97]
    COP [D0] ( #$000A )
    COP [1D] ( &string_06A949 )
    ...
    COP [01]                 ; return to caller
}
```

**Pattern C — Shared bank-local FX used by many actors**  
Mansion interactables `#INCLUDE` a plaque actor that exports `code_06C35C` (flash `$056E`, set bytes, delay). Multiple rooms:

```asm
; prinkys_mansion/actor_06C227.asm (and siblings)
code_06C23B {
    COP [00] ( &code_06C35C )   ; shared FX
    COP [0B] ( #$0072, &code_06C255 )
    COP [0A] ( #$0072 )
}
```

```asm
; mansion_tower2_plaque/actor_06C337.asm
code_06C35C {
    COP [34] ( #$FFF0 )
    COP [41] ( #0F )
    COP [D0] ( #$0010 )
    COP [42] ( #10 )
    COP [33] ( #$FFF0 )
    COP [01]
}
```

Often the gosub is reached after `COP [27]` redirects the **player** actor into the interact script — `[00]` then runs shared FX in that script context.

**Pattern D — Repeating a multi-frame effect inline**  
Crystal Dream cutscene calls the same blink/hold routine five times (`hacker_fortress/crystal_dream/actor_0CEA4F.asm` → `code_0CED8B`), which itself uses `[D0]`/`[05]`/`[CC]`/`[06]` across frames and finishes with `COP [01]`.

##### Top call targets (by frequency)

| Count | Target | Purpose |
|------:|--------|---------|
| 17 | `code_04CE89` | Credits wait+return |
| 17 | `code_04CE37` | Credits line emit |
| 17 | `code_04CE2E` | Credits wait |
| 16 | `code_04CDFB` | Credits setup |
| 6 | `code_0CED64` / `code_0B936E` / `code_06B67D` / `code_03F4B0` | Scene-local shared beats |
| 5 | `code_06C35C` | Mansion shared FX |
| 2 | `code_06A924` | Litho find beat |

##### Parameters & return contract (for renaming / docs)

| Item | Value |
|------|-------|
| Opcode | `$00` |
| Asm form | `COP [00] ( &label )` |
| Operand size | 2 bytes |
| Operand meaning | Near address of subroutine entry (same program bank) |
| Side effects | Sets `$7F001A,X`; redirects execution to `&label` |
| Does **not** | Push CPU stack frame; change bank; nest safely |
| Callee must | Eventually `COP [01]` to resume caller (or leave slot set while yielding mid-routine) |
| Suggested asm alias | `gosub &label` |

##### Relation to similar ops

| Op | Name | Difference from `[00]` |
|----|------|------------------------|
| `[01]` | `return` | Pops `$7F001A,X` → resume caller; empty slot → tick RTL |
| `[02]` | `return_main` | Resume `$7F0024,X` (main/idle), also clears `$7F001A` |
| `[03]` | `gosub_far` | 24-bit target; saves PC+bank in `$7F001C/1E,X` |
| `[04]` | `return_far` | Pair for `[03]` |
| `[09]` | `goto_far` | No return address saved |
| `[CF]` | `goto_far` | Far goto via `$28/$2A` |
| `[27]` | `queue_player_script` | Plants a `code_list_0BE679` vector into **player** `$7F001A` and sets `$28` — those vectors end with `[02]` |

- **WRAM touched:** `$02` (stack patch), `$2C` (script cursor)
- **Actor RAM:** `$7F001A,X`
- **Source examples:**
  - `credits/credits_festival/actor_04C9A3.asm:11-19` — sequenced gosubs into shared credit helpers
  - `seaside_cave/cave_storeroom/actor_06A82D.asm:58,80` — dual-path gosub to `code_06A924`
  - `prinkys_mansion/actor_06C227.asm:22` — gosub shared FX `code_06C35C`
  - `hacker_fortress/crystal_dream/actor_0CEA4F.asm:15-34` — repeated gosub to blink routine
  - `credits/credit_functions.asm` — callees ending in `COP [01]`

#### COP [01] — `return` (near script subroutine return)

- **Confidence:** high
- **Preferred name:** `return`
- **Aliases:** `return_near`, `gosub_return`
- **Handler:** `code_00A116` @ chunk_008000.asm:4363-4378
- **Parameters:** (none). Marked `halt` in copdef because the empty-slot path ends the actor tick with `RTL`.
- **Description:** Complete a `COP [00]` gosub: if `$7F001A,X` holds a return PC, resume there and clear the slot; if zero, `PLA PLA RTL` (no active gosub — yield/halt this entry).
- **Notes:** Mandatory epilogue of near gosub callees. May execute after multi-frame work inside the callee (delays, `RTL` polls, anim waits). Seen 114 times in extracted ASM.
- **WRAM touched:** `$02`
- **Actor RAM:** `$7F001A`
- **Usage count:** 114
- **Source examples:**
  - `credits/credit_functions.asm:24` — `COP [01]`
  - `credits/credit_functions.asm:65` — `COP [01]`
  - `credits/credit_functions.asm:76` — `COP [01]`
  - `credits/credit_functions.asm:89` — `COP [01]`
  - `hacker_fortress/crystal_dream/actor_0CECF0.asm:79` — `COP [01]` (end of `code_0CED8B`)

<details><summary>Handler excerpt</summary>

```asm
code_00A116 {
    TYX 
    LDA $7F001A, X
    BEQ loc_00A127

  loc_00A11D:
    STA $02, S
    LDA #$0000
    STA $7F001A, X
    RTI 

  loc_00A127:
    PLA 
    PLA 
    RTL 
}
```

</details>

#### COP [02] — `return_main` (resume saved main/idle PC)

- **Confidence:** high (handler + exhaustive call-site audit)
- **Preferred name:** `return_main`
- **Aliases:** `return_loop`, `return_at_24`, `resume_main`
- **Handler:** `code_00A12A` @ `extracted/system/chunk_008000.asm:4380-4384`
- **Parameters:** (none)
- **Usage count:** **14** — **all** in `extracted/system/chunk_0B8000.asm` (`code_list_0BE679` player action vectors)

##### What it does (exact semantics)

```asm
code_00A12A {
    TYX
    LDA $7F0024, X     ; sticky "home" / main-loop PC
    BRA loc_00A11D     ; same epilogue as COP [01]:
}                      ;   STA $02,S → RTI there
                       ;   STA #$0000 → $7F001A,X  (clears near-gosub slot)
```

So `[02]` is **not** a pair of `[00]`. It resumes whatever address is cached in **`$7F0024,X`**, and as a side effect clears **`$7F001A,X`** (same cleanup path as a successful `[01]`).

`$7F0024` is also written by:

| Writer | Meaning of `$7F0024` |
|--------|----------------------|
| `COP [05]` (`repeat_setup`) | Start of repeat body (loop head) |
| Player code in `actor_0BD8F4` (`code_0BE278`) | Explicitly `STA $7F0024,X` with `#&code_0BE26A` together with `$7F001A` — establishes **idle/main home** |

##### Why it exists

Player interact flow uses **two** return slots:

1. **`$7F001A`** — temporary “what to run when this script `COP [01]`s” (often a cleanup vector from `COP [27]` / `code_list_0BE679`).
2. **`$7F0024`** — long-lived **main loop / idle** resume address.

Typical chain:

```
NPC:  COP [27] ( #01, &interact_script )
      ; player.$7F001A ← &code_0BE6B0   (table entry 01)
      ; player.$28     ← &interact_script

Player runs interact_script …
interact ends with COP [01]  →  enters code_0BE6B0 (brief anim/cleanup)
code_0BE6B0 ends with COP [02]  →  resumes player.$7F0024 (true main/idle)
```

Without `[02]`, cleanup vectors would have to hardcode a jump back into the player state machine; `$7F0024` keeps that home address relocatable and shared with the repeat engine.

##### How it is used in source

Every site is an epilogue of a `code_list_0BE679` routine (indices `$00`–`$0C`) — the vectors `COP [27]` can plant:

| Label | Index | Role (brief) | Ends with |
|-------|------:|--------------|-----------|
| `code_0BE693` | 00 | Facing/tile FX then home | `[02]` |
| `code_0BE6B0` | 01 | Short anim (`#13`) then home | `[02]` |
| `code_0BE6BB` | 02 | Tile FX then home | `[02]` |
| `code_0BE6CC` | 03 | Examine / item messages (several exits) | `[02]` |
| `code_0BE73E` / `0BE761` | 04 / 05 | Spawn helper + flag `$000D` | `[02]` |
| `code_0BE784` | 06 | Anim `#17` | `[02]` |
| `code_0BE7A1` | 09 | Anim from `$0BAA` | `[02]` |
| `code_0BE7B4` / `0BE7BC` / `0BE7D6` | 0A–0C | More player one-shots | `[02]` |

Example (`chunk_0B8000.asm`):

```asm
code_0BE6B0 {
    COP [80] ( #13 )
    COP [97]
    COP [D0] ( #$0010 )
    COP [02]              ; return_main → $7F0024,X
}
```

**Not observed:** `[02]` inside ordinary NPC/`COP [05]` repeat bodies. In theory `[02]` during an active repeat would jump to the loop head (`[05]`’s `$7F0024`), but shipped scripts don’t do that.

##### Parameters & contract

| Item | Value |
|------|-------|
| Opcode | `$02` |
| Asm form | `COP [02]` |
| Requires | `$7F0024,X` previously set (player home or repeat head) |
| Side effects | Clears `$7F001A,X`; does **not** clear `$7F0024` |
| Suggested alias | `return_main` |

##### Relation to similar ops

| Op | Difference |
|----|------------|
| `[01]` | Returns via `$7F001A` (gosub / planted vector) |
| `[02]` | Returns via `$7F0024` (main/idle or loop head), clears `$7F001A` |
| `[04]` | Far return via `$7F001C/1E` |
| `[05]`/`[06]`/`[07]` | Counted repeat uses `$7F0024` as loop head (overwrites main/idle home) |

- **Actor RAM:** `$7F0024` (read), `$7F001A` (cleared via shared epilogue)
- **Source examples:** all 14 sites under `system/chunk_0B8000.asm` in `code_0BE693`…`code_0BE7D6`

#### COP [03] — `gosub_far` (24-bit script subroutine call)

- **Confidence:** high
- **Preferred name:** `gosub_far`
- **Aliases:** `call_far`, `far_gosub`
- **Handler:** `code_00A131` @ `extracted/system/chunk_008000.asm:4386-4403`
- **Pairs with:** `COP [04]` (`return_far`)
- **Parameters:** `@Code` — **24-bit** far pointer (`copdef`: `["@Code"]`)
- **Usage count:** 68 across ~52 files

##### What it does (exact semantics)

```asm
code_00A131 {
    TYX
    LDA [$2C]          ; target PC (16)
    INC $2C : INC $2C
    STA $02, S         ; RTI → callee PC
    LDA [$2C]          ; target bank (8)
    INC $2C
    AND #$00FF
    SEP #$20
    STA $04, S         ; RTI → callee bank
    REP #$20
    LDA $2C
    STA $7F001C, X     ; save return PC (after operand)
    LDA $2A
    STA $7F001E, X     ; save return bank (current script bank)
    RTI
}
```

Same interrupt-patch technique as `[00]`, plus **program bank** on the stack and a **separate** far-return pair (`$7F001C` / `$7F001E`). Near gosub slot `$7F001A` is untouched — near and far gosubs use different slots (still each only one level deep).

##### Why it exists

`[00]` is same-bank only (`&Code`). Shared systems live in fixed banks (doors in bank `$03`, fades/transitions in `$04`, menus in `$0C`) while callers are scattered across map banks `$06`–`$09`, etc. `gosub_far` lets any actor run those libraries and return to the correct bank.

Also needed when the callee must execute with a different **program bank** so its local `&` refs resolve correctly.

##### How it is used in source (patterns)

**Pattern A — Door / warp open (dominant: 44×)**  
After `COP [73]` (warp setup), doors (`#4A` and many `#49` triggers) far-gosub the shared opener:

```asm
COP [73] ( #$0000, #$C175, @code_0786A2, @code_078689 )
COP [03] ( @code_03FB43 )    ; gosub_far door open FX / state
; … dialog / flags after return …
```

`code_03FB43` (`chunk_038000.asm`) plays the open animation / flag choreography and ends the success path with **`COP [04]`**.

**Pattern B — Screen fade / transition helpers (bank `$04`)**  

| Target | Count | Role |
|--------|------:|------|
| `code_04BF4D` | 11 | Longer transition (palette/HDMA-ish loop) then `[04]` |
| `code_04BF14` | 1 | Fade out (`INIDISP` down) then `[04]` |
| `code_04BF32` | 1 | Fade in then `[04]` |

Example (`hacker_fortress/return_to_quintenix/actor_04E38A.asm`):

```asm
COP [03] ( @code_04BF14 )    ; fade out
COP [AF] ( @code_04E3F3, #$0080, #$0270 )
...
COP [03] ( @code_04BF32 )    ; fade in
```

**Pattern C — Cross-bank UI / inn / menu**  
- `native_inn`: `@code_0CAC46`, `@code_0CAC7A`, …
- Menu entry: `@code_0C82CA` (from `actor_0C8000` / `chunk_0B8000`), often wrapped with `PHB`/`PLB` so **data bank** is preserved while `[03]` switches **program bank**:

```asm
code_0C82C2 {
    PHB
    COP [03] ( @code_0C82CA )
    PLB
    RTL
}
```

##### Top call targets

| Count | Target | Purpose |
|------:|--------|---------|
| 44 | `code_03FB43` | Shared door/warp open |
| 11 | `code_04BF4D` | Transition effect |
| 5 | `code_0CAC14` | (inn/UI family) |
| 2 each | `code_0CAC7A`, `0CAC46`, `0C82CA` | Inn / menu |
| 1 each | `code_04BF14`, `04BF32` | Fade out / in |

##### Parameters & contract

| Item | Value |
|------|-------|
| Opcode | `$03` |
| Asm form | `COP [03] ( @label )` |
| Operand | 3 bytes (PC lo/hi, bank) |
| Saves | `$7F001C,X` = return PC, `$7F001E,X` = return bank (`$2A`) |
| Callee must | `COP [04]` to resume (or empty-slot path RTLs) |
| Suggested alias | `gosub_far @label` |

- **WRAM:** `$02`, `$04` (stack), `$2A`, `$2C`
- **Actor RAM:** `$7F001C`, `$7F001E`
- **Source examples:**
  - `fathers_house/fathers_yard/actor_07863A.asm:13` — door → `@code_03FB43`
  - `hacker_fortress/return_to_quintenix/actor_04E38A.asm:33,42` — fades
  - `native_village/native_inn/actor_07BD34.asm:35,57` — inn helpers
  - `system/actor_0C8000.asm:306` — menu far entry

#### COP [04] — `return_far` (24-bit script subroutine return)

- **Confidence:** high
- **Preferred name:** `return_far`
- **Aliases:** `far_return`, `gosub_far_return`
- **Handler:** `code_00A154` @ `extracted/system/chunk_008000.asm:4405-4423`
- **Parameters:** (none)
- **Usage count:** 35 (callees of `[03]`, concentrated in banks `$03`/`$04`/`$0C`)

##### What it does (exact semantics)

```asm
code_00A154 {
    TYX
    LDA $7F001C, X
    BEQ loc_00A171          ; no pending far gosub → PLA PLA RTL
    STA $02, S              ; restore PC
    SEP #$20
    LDA $7F001E, X
    STA $2A                 ; restore script bank var
    STA $04, S              ; restore program bank on stack
    REP #$20
    LDA #$0000
    STA $7F001C, X          ; clear far slot (bank slot left stale OK)
    RTI
}
```

Mirrors `[01]`, but restores **bank** as well. Empty `$7F001C` → end actor tick (`RTL`).

##### Why / how used

Epilogue of every far-gosub library routine that must return to a foreign-bank caller:

- Door opener `code_03FB43` (success path)
- Fade/transition `code_04BF14` / `04BF32` / `04BF4D`
- Menu leaves in `actor_0C8000` — many short dialog branches end with bare `COP [04]` because they were entered via `[03]` from another bank:

```asm
code_0C82F6 {
    COP [67]
    COP [1F] ( &string_0C8932 )
    COP [04]                 ; return_far to caller bank
}
```

##### Parameters & contract

| Item | Value |
|------|-------|
| Opcode | `$04` |
| Asm form | `COP [04]` |
| Requires | Prior `[03]` on this actor (non-zero `$7F001C,X`) |
| Side effects | Clears `$7F001C,X`; restores `$2A` and stack bank from `$7F001E,X` |
| Suggested alias | `return_far` |

##### Near vs far gosub (summary)

| | Near `[00]`/`[01]` | Far `[03]`/`[04]` |
|--|-------------------|-------------------|
| Pointer | `&Code` (16-bit) | `@Code` (24-bit) |
| Return slot | `$7F001A` | `$7F001C` + `$7F001E` (bank) |
| Bank switch | No | Yes (stack `$04,S` + `$2A`) |
| Typical use | Same-bank helpers | Doors, fades, menus, cross-bank libs |
| Depth | Single level | Single level |

- **WRAM:** `$02`, `$04`, `$2A`
- **Actor RAM:** `$7F001C`, `$7F001E`
- **Source examples:**
  - `system/chunk_038000.asm:14784` — end of door open path
  - `system/chunk_048000.asm:6216,6229,6265` — fade/transition returns
  - `system/actor_0C8000.asm:328+` — menu dialog returns

#### COP [05] — `repeat_begin` (start counted loop)

- **Confidence:** high
- **Preferred name:** `repeat_begin`
- **Aliases:** `repeat_setup`, `for_count`, `loop_begin`
- **Handler:** `code_00A174` @ `extracted/system/chunk_008000.asm:4425-4435`
- **Closes with:** `COP [06]` (`repeat_yield`) or `COP [07]` (`repeat_continue`)
- **Parameters:** `Word` — iteration count **N** (`copdef`: `["Word"]`)
- **Usage count:** 233

##### What it does (exact semantics)

```asm
code_00A174 {
    TYX
    LDA [$2C]
    INC $2C : INC $2C
    STA $7F0026, X     ; remaining iterations = N
    LDA $2C
    STA $7F0024, X     ; loop head = first opcode of body
    STA $02, S         ; fall into body immediately
    RTI
}
```

After `[05]`, execution continues at the next instruction (the **loop body**). The body runs until it hits `[06]` or `[07]`, which decide whether to rewind to `$7F0024` or fall through.

**Iteration math:** N is the number of times the body runs.

| N | Behavior |
|---|----------|
| `1` | Body once; closer DECs to 0 → exit (no rewind) |
| `2` | Body, rewind, body, exit |
| `#$0020` (32) | Common blink/pulse length |

##### Why it exists

Scripts need multi-frame pulses (blink `$06` bit `$2000`), repeated spawns, and “do this beat N times” without unrolling. The count lives in actor WRAM (`$7F0026`) so the loop survives `RTL` yields inside the body (`[CC]`, `[D0]`, anim waits, gosubs).

**Slot sharing with `[02]`:** `[05]` **overwrites `$7F0024,X`**. That same word is the player’s idle home for `return_main`. Repeats are almost always on non-player actors (or far-gosub callees using the *caller’s* X); after the loop finishes, `$7F0024` is **left** pointing at the old loop head (not restored).

##### How it is used in source

**Pattern A — Blink / visibility pulse (most common with `[06]`)**  

```asm
COP [05] ( #$0010 )          ; repeat_begin 16
LDA #$2000
TSB $06                      ; hide/flash on
COP [CC]                     ; yield a tick
LDA #$2000
TRB $06                      ; flash off
COP [06]                     ; repeat_yield → back to TSB or exit
```

Seen throughout cutscenes (`crystal_dream/actor_0CECF0.asm` `code_0CED68` / `0CED8B`), doors (`code_03FB43`), world map FX, etc. Top counts: `#$0020` (37), `#$0003` (31), `#$0004` (20), `#$0008` (16), `#$0010` (14).

**Pattern B — Credits multi-line wait (`[07]` closer)**  

```asm
COP [05] ( #$0002 )          ; show/wait this beat twice
COP [00] ( &code_04CE2E )    ; gosub wait helper
COP [D0] ( #$0168 )
COP [07]                     ; repeat_continue (no extra yield between iters)
COP [00] ( &code_04CE89 )
```

Almost all `[07]` sites are credits directors (`credits_*`). Counts are usually `1`–`3`.

**Pattern C — Same-tick multi-spawn (`[07]`)** (`chunk_038000.asm`):

```asm
COP [05] ( #$000C )
COP [AD] ( @code_03DC42, #$0000, #$FFE0 )  ; spawn child
COP [80] ( #07 )
COP [97]
COP [07]                     ; immediately next spawn this tick
```

**Pattern D — Timed work inside loop** (`actor_04B881.asm`): `[05]` + `[D0]` delays + native `JSR` + `[06]`.

##### Common N values

| N | Count of sites | Typical meaning |
|--:|---------------:|-----------------|
| `$20` | 37 | Long blink (~32 half-cycles) |
| `$03` | 31 | Short triple pulse |
| `$04` | 20 | Quad pulse / short cycle |
| `$08` / `$10` | 16 / 14 | Medium blink |
| `$01`/`$02` | 14 / 14 | Credits single/double beats |

##### Parameters & contract

| Item | Value |
|------|-------|
| Opcode | `$05` |
| Asm form | `COP [05] ( #$NNNN )` |
| Writes | `$7F0026,X` = N; `$7F0024,X` = body PC |
| Body must | Eventually `COP [06]` or `COP [07]` |
| Suggested alias | `repeat_begin #N` |

- **WRAM:** `$02`, `$2C`
- **Actor RAM:** `$7F0024`, `$7F0026`
- **Source examples:**
  - `hacker_fortress/crystal_dream/actor_0CECF0.asm:49-55` — blink `[05]`/`[06]`
  - `credits/credits_festival/actor_04C9A3.asm:15-18` — `[05]`/`[07]` credits
  - `boot/title_screen/actor_04E60C.asm:20` — `#$0020` pulse
  - `system/chunk_038000.asm:11456-11460` — multi-spawn `[07]`

#### COP [06] — `repeat_yield` (end iteration; yield if more remain)

- **Confidence:** high
- **Preferred name:** `repeat_yield`
- **Aliases:** `repeat_next`, `next_yield`, `loop_yield`
- **Handler:** `code_00A188` @ `extracted/system/chunk_008000.asm:4437-4453`
- **Parameters:** (none)
- **Usage count:** 219 (default closer for `[05]`)

##### What it does (exact semantics)

```asm
code_00A188 {
    TYX
    LDA $7F0026, X
    DEC
    BEQ loc_00A19D           ; was 1 → now 0: exit loop
    STA $7F0026, X           ; store remaining
    LDA $7F0024, X
    STA $28                  ; resume at loop head next entry
    PLA : PLA
    RTL                      ; *** yield this actor tick ***

  loc_00A19D:
    LDA $2C
    STA $02, S               ; fall through past [06]
    RTI
}
```

| Remaining after DEC | Action |
|---------------------|--------|
| `≠ 0` | Set `$28` = loop head, **`RTL`** (cooperative yield). Next tick resumes at body start. |
| `0` | Continue at the instruction **after** `[06]` (loop finished). |

Does **not** clear `$7F0024` / `$7F0026` on exit (counter ends at 0; head address left stale).

##### Why / when vs `[07]`

`[06]` inserts at least one **full actor yield** between iterations (in addition to any yields inside the body). That matches blink patterns: each half-cycle should be visible for a frame (`[CC]` inside body + `[06]` between cycles).

Dominant pairing: `[05]` … blink/`[CC]` … **`[06]`**.

##### Parameters & contract

| Item | Value |
|------|-------|
| Opcode | `$06` |
| Asm form | `COP [06]` |
| Requires | Prior `[05]` on this actor |
| Suggested alias | `repeat_yield` |

- **WRAM:** `$28`, `$2C`
- **Actor RAM:** `$7F0024` (read), `$7F0026` (DEC)
- **Source examples:**
  - `hacker_fortress/crystal_dream/actor_0CECF0.asm:55` — blink closer
  - `boot/title_screen/actor_04E60C.asm:26`
  - `system/chunk_038000.asm` — door/cutscene pulses
  - `world/space/actor_04B506.asm:39` — space FX

#### COP [07] — `repeat_continue` (end iteration; continue same tick if more remain)

- **Confidence:** high
- **Preferred name:** `repeat_continue`
- **Aliases:** `repeat_next_now`, `next_continue`, `loop_continue`
- **Handler:** `code_00A1A2` @ `extracted/system/chunk_008000.asm:4455-4470`
- **Parameters:** (none)
- **Usage count:** 19 (17 credits directors + 2 in `chunk_038000.asm`)

##### What it does (exact semantics)

Identical counting to `[06]`, but when iterations remain it **does not RTL**:

```asm
code_00A1A2 {
    TYX
    LDA $7F0026, X
    DEC
    BEQ loc_00A1B7
    STA $7F0026, X
    LDA $7F0024, X
    STA $28
    STA $02, S               ; RTI → loop head ***this tick***
    RTI

  loc_00A1B7:
    LDA $2C
    STA $02, S               ; exit past [07]
    RTI
}
```

So remaining iterations restart the body **immediately** in the same actor entry (no forced frame gap at the closer). Body-internal yields (`[D0]`, gosub waits, `[CC]`) still apply.

##### Why it exists

1. **Credits** — repeat “wait for credit line + delay” N times without an extra empty tick between `[07]` and the next wait (`credits_festival` uses `N=2`; most scenes use `N=1`, where `[06]`/`[07]` exit paths are equivalent).
2. **Burst spawns** — fire N children back-to-back in one tick (`chunk_038000` `#$000C` spawn loop).

##### `[06]` vs `[07]` (summary)

| | `repeat_yield` `[06]` | `repeat_continue` `[07]` |
|--|----------------------|--------------------------|
| More iters left | `$28` = head, **`RTL`** (yield) | `$28` = head, **`RTI` to head** (same tick) |
| Done | Fall through | Fall through |
| Typical | Blink / pulse FX | Credits waits; multi-spawn |
| Sites | 219 | 19 |

##### Parameters & contract

| Item | Value |
|------|-------|
| Opcode | `$07` |
| Asm form | `COP [07]` |
| Requires | Prior `[05]` on this actor |
| Suggested alias | `repeat_continue` |

- **WRAM:** `$02`, `$28`, `$2C`
- **Actor RAM:** `$7F0024`, `$7F0026`
- **Source examples:**
  - `credits/credits_festival/actor_04C9A3.asm:15-18` — `N=2` credit waits
  - `credits/credits_family/actor_04C9DB.asm:14-17` — `N=1`
  - `system/chunk_038000.asm:11456-11460` — spawn×12
  - `system/chunk_038000.asm:13082-13087` — short `[07]` loop with `[EA]`

##### Repeat family vs other control flow

| Mechanism | Slots | Yields between iters? |
|-----------|-------|------------------------|
| `[05]`/`[06]`/`[07]` | `$7F0024` head, `$7F0026` count | `[06]` yes; `[07]` no (at closer) |
| `[00]`/`[01]` gosub | `$7F001A` | Only if callee yields |
| `[D0]` delay | `$0E`, `$28` | Always (timed) |
| `[02]` return_main | reads `$7F0024` | — **conflicts** if used while a repeat owns `$7F0024` |

#### COP [09] — `goto_far` (unconditional 24-bit jump)

- **Confidence:** high
- **Preferred name:** `goto_far`
- **Aliases:** `jump_far`, `far_goto`
- **Handler:** `code_00A1D9` @ `extracted/system/chunk_008000.asm:4497-4512`
- **Parameters:** `@Code` (24-bit)
- **Usage count:** 25

##### What it does

```asm
; Handler (complete)
code_00A1D9 {
    TYX
    LDA [$2C]              ; target PC (16)
    INC $2C
    INC $2C
    STA $28
    STA $02, S             ; RTI → target PC
    LDA [$2C]              ; target bank (8)
    INC $2C
    AND #$00FF
    STA $2A                ; update current script bank
    SEP #$20
    STA $04, S             ; RTI → target bank
    REP #$20
    RTI                    ; no $7F001C/1E save — no return
}
```

Like `[03]` `gosub_far` **without** saving `$7F001C/1E`. Control never comes back via `[04]`.

> **Family:** control flow / far transfer — not flags, despite sitting between `[08]` and `[0A]`.

##### Why / how used

Tail-call into shared bank `$03`/`$04` state machines (battle/enemy exits, cave transitions into `code_04BEDE`, menu jumps to `code_04B2F8`). Prefer `[09]` over `[03]` when the current script is finished.

Top targets: `code_03B715` (8), `code_03B9F8` (7), `code_04BEDE` (2).

```asm
COP [86] ( #0D, #10, #05 )
COP [98]
COP [09] ( @code_04BEDE )   ; goto_far — no return
```

| vs | Difference |
|----|------------|
| `[03]`/`[04]` | Far **gosub** with return |
| `[CF]` | Far goto via `$28/$2A` only (related) |
| `[00]` | Near gosub |

- **Source examples:**
  - `seaside_cave/cave_entrance/actor_068000.asm:56` — `@code_04BEDE`
  - `system/chunk_0B8000.asm:55` — `@code_04B2F8`
  - `system/chunk_02E9AA.asm` — enemy → `@code_03B9F8`

#### COP [27] — `queue_player_script` (hijack player into a script + plant cleanup)

- **Confidence:** high (handler + table + call-site audit)
- **Preferred name:** `queue_player_script`
- **Aliases:** `player_call`, `start_player_action`, `set_player_1A`
- **Handler:** `code_00A793` @ `extracted/system/chunk_008000.asm:5420-5439`
- **Parameters:** `Byte` mode index, `&Code` player script (or `#$0000` = no redirect)
- **Usage count:** 167

##### What it does

```asm
code_00A793 {
    TYX
    PHX
    LDA [$2C]                 ; mode #
    INC $2C
    AND #$00FF
    ASL
    TAX
    LDA $@code_list_0BE679, X ; cleanup / action vector
    LDX $0EEE                 ; ★ PLAYER slot, not caller
    STA $7F001A, X            ; plant into player near-gosub
    PLX                       ; restore caller X
    LDA [$2C]                 ; &Code
    BEQ skip_redirect         ; #$0000 → cleanup only
    STA $28                   ; redirect *current* script PC
    STZ $0E                   ; clear delay so it runs next

  skip_redirect:
    JMP $&code_009F00         ; caller continues (no RTI rewrite)
}
```

Critical details:

1. **Target is the player.** Index comes from `$0EEE` (player host slot). The NPC that issued `[27]` does **not** change its own `$7F001A`.
2. **`STA $28` runs in the caller’s COP context.** Interact dispatch (`code_0BE478`) already switched the active script context onto the player before running the interact body, so `$28`/`$0E` updates apply to the **player** when `[27]` is used from a talk script. Standalone uses with `#$0000` only plant cleanup.
3. **Mode byte indexes `code_list_0BE679`** (`chunk_0B8000.asm:10646`) — 13 entries `$00`–`$0C`. Every vector ends with `COP [02]` (`return_main`).
4. Caller always falls through via `code_009F00` (advance past operands / continue).

##### Mode table (`code_list_0BE679`)

| Idx | Label | Role | Ends |
|----:|-------|------|------|
| `$00` | `code_0BE693` | Tile FX + short walk anim | `[02]` |
| `$01` | `code_0BE6B0` | Short anim `#13` (most common “talk done” cleanup) | `[02]` |
| `$02` | `code_0BE6BB` | Tile FX only | `[02]` |
| `$03` | `code_0BE6CC` | Examine / item messages | `[02]` |
| `$04` / `$05` | `0BE73E` / `0BE761` | Spawn helper + set flag `$000D` | `[02]` |
| `$06` | `code_0BE784` | Anim `#17` | `[02]` |
| `$07` / `$08` | `0BE78B` / `0BE796` | Anim `#17` then wait flag → `$04`/`$05` path | → |
| `$09` | `code_0BE7A1` | Anim from player facing `$0BAA+8` | `[02]` |
| `$0A`–`$0C` | `0BE7B4`… | Misc one-shots | `[02]` |

##### Usage patterns (by first operand)

| Mode | Count | Typical use |
|-----:|------:|-------------|
| `#06` | 81 | Talk → anim `#17` cleanup (generic NPC) |
| `#07` | 38 | Talk → wait `$000D` then spawn helper |
| `#09` | 24 | Facing-based anim cleanup (drawers, signs, objects) |
| `#01` | 18 | Short `#13` cleanup |
| `#04` | 2 | Spawn-helper path (null `&Code` common) |
| `#00`/`#03`/`#0B`/`#0C` | 1 each | Rare specials |

**Null `&Code` (`#$0000`)** — 10 sites. Plants cleanup only; player script PC unchanged. Used when the interact body already finished (or never redirected), e.g. `system/actor_058000.asm` `COP [27] ( #00, #$0000 )`.

##### Canonical flow

```
NPC interact (already running as player context):
    COP [27] ( #01, &talk_body )
    ; player.$7F001A ← &code_0BE6B0
    ; player.$28     ← &talk_body

talk_body:
    COP [1D] ( &string_… )
    COP [01]                 ; → code_0BE6B0
code_0BE6B0:
    COP [80] ( #13 ) …
    COP [02]                 ; return_main → player.$7F0024
```

| Item | Value |
|------|-------|
| Suggested alias | `queue_player_script #mode, &script` |
| Pairs with | `[01]` → planted vector; `[02]` → main/idle |
| Does **not** | Touch caller `$7F001A` |

- **WRAM:** `$0EEE` (read), player `$7F001A`, `$28`, `$0E`, `$2C`
- **Source examples:**
  - `fathers_house/fathers_house/actor_079621.asm:18` — `#09, &code_079637` (Father’s Letter)
  - `system/actor_058000.asm:21` — `#00, #$0000` (cleanup only)
  - `prinkys_mansion/mansion_west_bedroom/actor_06F05E.asm:26` — `#04, #$0000`
