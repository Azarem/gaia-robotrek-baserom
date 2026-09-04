# Actor Destroy (`[B2]`–`[B3]`)

Two opcodes that remove actors from the execution chain and return their slots to the free pool.

## Overview

Both ops unlink the calling actor from the doubly-linked execution chain (`$24`/`$26`, endpoints `$0EF4`/`$0EF6`) and push the freed slot(s) back onto the sequential allocator pool at `$56`. `[B2]` destroys only the calling actor. `[B3]` first destroys consecutive child actors (matched via `$7F0022,X`), then destroys the calling actor itself.

| Op | Name | Operands | Uses |
|----|------|----------|-----:|
| `B2` | `destroy_self` | (none) | 534 |
| `B3` | `destroy_self_and_children` | (none) | 6 |

---

## `[B2]` — `destroy_self`

Unlinks the calling actor from the execution chain and frees its slot. This is the standard way for an actor to terminate itself.

### Handler: `code_00C73A`

```
code_00C73A:
  TYX                       ; X = current actor slot
  JSL code_04FD4E           ; Destroy self
  LDA $2C : STA $02, S     ; advance script pointer (pro forma)
  RTI
```

### Parameters

(none)

### Helper: `code_04FD4E` — Self-destruct

Unlinks the actor from the doubly-linked chain, handling all three positions:

```
code_04FD4E:
  LDY $24                   ; Y = back-link (toward $0EF4)
  BNE has_predecessor
  ; No predecessor → actor is at $0EF4 end
  LDY $26                   ; Y = forward-link
  STY $0EF4                 ; successor becomes new $0EF4
  BEQ free_slot             ; if no successor either, skip fixup
  LDA #$0000
  STA $0024, Y              ; clear successor's back-link
  BRA free_slot

has_predecessor:
  LDA $26                   ; A = forward-link (toward $0EF6)
  STA $0026, Y              ; predecessor's forward = our forward
  BNE has_both
  STY $0EF6                 ; no successor → predecessor becomes $0EF6
  BRA free_slot

has_both:
  TAY                       ; Y = successor
  LDA $24                   ; A = predecessor
  STA $0024, Y              ; successor's back = our predecessor

free_slot:
  PHD
  LDA #$0000 : TCD          ; DP = 0
  SEP #$20
  DEC $56 : DEC $56         ; decrement pool pointer (grows downward)
  REP #$20
  TXA : STA ($56)           ; push slot index onto free pool
  PLD : RTL
```

Key chain details:
- `$24` = back-link (toward `$0EF4` / chain head)
- `$26` = forward-link (toward `$0EF6` / chain tail)
- `$0EF4` = chain head (element with `$24 == 0`)
- `$0EF6` = chain tail (element with `$26 == 0`)
- `$56` = free pool stack pointer (grows downward, each slot is a word)

### Usage (534 sites)

The third-most-used COP opcode overall. Ubiquitous as the standard actor termination — appears at the end of virtually every child actor's script, one-shot effect actors, cutscene workers, and temporary system processes.

### Source examples

```
; End of a visual effect actor
COP [8F] ( #18, #00 )
COP [9C]
COP [B2]

; Actor terminates after completing its task
COP [01]               ; yield
COP [B2]               ; destroy self
```

---

## `[B3]` — `destroy_self_and_children`

Walks the forward chain (`$26`) starting from the calling actor, frees all consecutive child actors whose `$7F0022,X` matches the caller (i.e., actors spawned by the caller), then unlinks and frees the caller itself.

### Handler: `code_00C744`

```
code_00C744:
  TYX                       ; X = current actor slot
  JSL code_04FD85           ; Destroy children + self
  LDA $2C : STA $02, S
  RTI
```

### Parameters

(none)

### Helper: `code_04FD85` — Destroy children + self

```
code_04FD85:
  PHD
  LDA #$0000 : TCD          ; DP = 0 (for $56 pool access)

child_loop:
  LDA $0026, X              ; A = next in chain ($26 link)
  TAX                       ; X = next actor
  BEQ done_children         ; if end of chain, stop
  TYA                       ; A = Y (original parent actor)
  CMP $7F0022, X            ; does this child belong to us?
  BNE done_children         ; no → stop (only frees consecutive children)
  SEP #$20
  DEC $56 : DEC $56         ; push to free pool
  REP #$20
  TXA : STA ($56)           ; store freed slot
  BRA child_loop            ; continue to next

done_children:
  PLD                        ; restore DP = actor DP
  ; X = first non-child (or 0); unlink self between $24 and X:
  LDY $24                   ; Y = our predecessor
  BNE has_pred
  STX $0EF4                 ; no predecessor → X becomes $0EF4
  CPX #$0000
  BEQ free_self
  LDA #$0000 : STA $0024, X ; clear follower's back-link
  BRA free_self

has_pred:
  TXA : STA $0026, Y        ; predecessor.$26 = X (skip us + children)
  BNE has_follower
  STY $0EF6                 ; no follower → predecessor becomes $0EF6
  BRA free_self

has_follower:
  LDA $24 : STA $0024, X    ; follower.$24 = our predecessor

free_self:
  TDC : TAX                 ; X = actor slot (TDC loads DP = actor base)
  PHD
  LDA #$0000 : TCD
  SEP #$20
  DEC $56 : DEC $56
  REP #$20
  TXA : STA ($56)           ; free our own slot
  PLD : RTL
```

The walk only frees **consecutive** children in the `$26` direction. Since `code_00E535` and `code_00E55E` insert children immediately after/before the parent, consecutive children are the normal case. Non-child actors interleaved in the chain act as a stop condition.

### Usage (6 sites)

Rare compared to `[B2]`. Used by parent actors that spawn multiple children (via `[AA]`–`[B1]` or `[A3]`–`[A5]`) and need to clean up the entire group at once:

| File | Context |
|------|---------|
| `actor_02E9AA.asm:133` | Inventory menu item cursor — destroys child effect actors on dismiss |
| `actor_02F1F3.asm:218,229` | Battle helper — destroys child animation actors after a sequence completes |
| `chunk_038000.asm:6299` | Battle system — cleanup after checking `$05CC` flag |
| `chunk_038000.asm:12768` | Battle end — full cleanup of screen effect children |
| `chunk_038000.asm:14035` | Battle system — similar group cleanup |

### Source examples

```
; Battle end: clean up visual effects, then terminate
LDA #$00
STA $CGADSUB
LDA #$E0
STA $COLDATA
REP #$20
COP [B3]
RTL

; Animation loop: wait for flag, then destroy group
COP [81] ( #08, #05 )
COP [97]
LDA $06
BIT #$4000
BEQ loop
COP [B3]
RTL
```

---

## Family notes

1. **Single execution chain**: Both `$0EF4` (head) and `$0EF6` (tail) are endpoints of the same doubly-linked chain. `$24` links toward the head; `$26` links toward the tail. `code_04FD4E` and `code_04FD85` correctly handle unlinking from any position (head, middle, tail).

2. **Free pool mechanism**: The slot allocator at `$56` is a downward-growing stack. `code_0481EE` pops a slot by reading `($56)` and incrementing `$56` by 2. The destroy helpers push slots back by decrementing `$56` by 2 and writing the slot index. This is a true stack — slots are recycled in LIFO order.

3. **B3 consecutive-only limitation**: `code_04FD85` only frees children that are consecutive in the `$26` chain. If a non-child actor has been inserted between children (via another spawn op), children beyond that point won't be freed. In practice this is rarely an issue since child spawns cluster together.

4. **B3 is always terminal**: All 6 call sites are followed by `RTL`, confirming the actor terminates after destroying its group. The script pointer advance in the handler is technically dead code.

5. **B2 dominance**: With 534 sites, `[B2]` is the standard termination opcode. Most actors end with `COP [B2]` or with `COP [01]` (yield) followed by `COP [B2]`.

## Relationship to other families

| Related family | Connection |
|---------------|------------|
| [Actor Spawn — Main Chain](actor_spawn.md) `[A2]`–`[A8]` | Spawn ops that `[B2]`/`[B3]` undo — allocate slots and link into the chain |
| [Actor Spawn — Render Chain](actor_spawn_render.md) `[A9]`–`[B1]` | Same relationship — `[B2]`/`[B3]` free actors spawned by these ops |
| [Control Flow](control_flow.md) `[01]`/`[02]` | `[01]` (yield) and `[02]` (return to idle) often precede or follow `[B2]` |
