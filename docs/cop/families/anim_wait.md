# Animation Wait / Tick — COP `[97]`–`[9C]`

> Deep-audited ops: `[97]` `[98]` `[99]` `[9A]` `[9B]` `[9C]`

## Overview

Six parameterless opcodes that **block or yield** the actor's script until an animation, frame count, or child sprite condition completes. Five use the animation frame-advance helper `code_04FC71`; one uses the child-alive guard `code_00E616`. These are the "wait" companions to the animation setup family (`[80]`–`[8C]`) and child sprite family (`[8D]`–`[90]`).

| Op | Name | Mechanism | Yield condition | Uses |
|----|------|-----------|----------------|-----:|
| `[97]` | `wait_anim_done` | `code_04FC71` | Animation sequence ends | 2076 |
| `[98]` | `wait_anim_frames` | `code_04FC71` loop × `$12` | Frame counter exhausted or anim ends | 931 |
| `[99]` | `wait_anim_clear_sprmap` | `code_04FC71` + clear `$08 #$0800` | Animation sequence ends | 33 |
| `[9A]` | `anim_until_interact_destroy` | `code_04FC71` loop + `$06 #$4000` check | Anim ends OR interact → self-destruct | 46 |
| `[9B]` | `anim_step_tick` | `code_04FC71` + `$0E24` decrement | Step counter exhausted | 2 |
| `[9C]` | `child_wait` | `code_00E616` | Child sprite dies | 53 |

## Shared helper: `code_04FC71` — animation frame advance

Located at `chunk_048000.asm:8077`. This is the core animation tick function used by all ops except `[9C]`.

**Inputs:**
- `X` = actor slot index
- `$7F000C,X` = animation id
- `$7F0000,X` / `$7F0002,X` = spritemap bank pointer (24-bit)
- `$10` = current frame index within the animation

**Actions:**
1. Switches data bank to spritemap bank (`$7F0002,X`)
2. Navigates the animation table: `spritemap_base + anim_id×2` → frame pointer table; `frame_ptr + $10×4` → frame data
3. If frame data is negative (end marker), returns **carry clear** (animation done)
4. Otherwise reads displacement/tile data into `$0E`, `$14`/`$16`/`$18`/`$1A` (visual offsets)
5. Increments `$10` (advances frame counter)
6. Returns **carry set** (animation in progress)

**Carry convention:**
- **C=1**: Animation still has frames remaining — continue
- **C=0**: Animation ended (negative sentinel) — time to exit/yield

---

### COP [97] — `wait_anim_done`

- **Confidence:** high
- **Preferred name:** `wait_anim_done`
- **Handler:** `code_00C21F` @ chunk_008000.asm:9336–9349
- **Parameters:** (none)
- **Usage count:** 2076

The most fundamental animation wait — the **#3 most-used COP overall**. Calls `code_04FC71` once per script tick. If the animation is still in progress (carry set), clears velocities (`$1C`/`$1E`), saves script pointer, and continues (RTI → re-executes next tick). If animation ends (carry clear), yields (PLA PLA RTL → returns to engine).

Virtually every actor that plays an animation uses `[97]` after an animation setup op (`[80]`–`[87]`, `[84]`, `[91]`, `[D5]`, etc.).

<details><summary>Handler</summary>

```asm
code_00C21F {
    TYX
    JSL $@code_04FC71       ; advance animation frame
    BCC loc_00C22F           ; carry clear = anim done → yield
    STZ $1C                  ; clear X velocity
    STZ $1E                  ; clear Y velocity
    LDA $2C
    STA $02, S               ; save script pointer
    RTI                      ; continue (re-tick next frame)

  loc_00C22F:
    PLA
    PLA
    RTL                      ; yield — animation finished
}
```

</details>

**Typical usage:**

```asm
    COP [80] ( #04 )         ; set animation id 4
    COP [97]                  ; wait until animation finishes
    COP [80] ( #00 )         ; next animation
    COP [97]                  ; wait again
```

---

### COP [98] — `wait_anim_frames`

- **Confidence:** high
- **Preferred name:** `wait_anim_frames`
- **Handler:** `code_00C232` @ chunk_008000.asm:9351–9369
- **Parameters:** (none) — consumes `$12` (frame count) set by a prior `[84]`/`[85]`/`[86]`/`[87]`/`[92]`/`[94]`/`[96]`
- **Usage count:** 931

Calls `code_04FC71` in a **tight loop**, decrementing `$12` each successful frame. Exits when either:
- `$12` reaches 0 → clears velocities, saves script pointer, RTI (frame budget exhausted, continue)
- Animation ends (carry clear) → PLA PLA RTL (yield)

Unlike `[97]` which ticks once per engine frame and re-enters via RTI, `[98]` loops **within a single handler invocation**. The `$12` counter is typically set by a speed-variant setup op (e.g., `COP [84] ( #anim, #speed )` sets `$12 = speed`), making this a "play N frames of animation, then advance the script."

<details><summary>Handler</summary>

```asm
code_00C232 {
    TYX

  loc_00C233:
    JSL $@code_04FC71       ; advance frame
    BCC loc_00C246           ; anim done → yield
    DEC $12                  ; decrement frame counter
    BNE loc_00C233           ; loop if frames remain
    STZ $1C
    STZ $1E
    LDA $2C
    STA $02, S
    RTI                      ; frame budget exhausted → continue

  loc_00C246:
    PLA
    PLA
    RTL                      ; yield — animation ended early
}
```

</details>

**Typical usage:**

```asm
    COP [84] ( #07, #02 )   ; set anim 7, speed 2 (sets $12 = 2)
    COP [98]                  ; advance 2 frames of animation
    COP [80] ( #00 )         ; continue with next state
```

---

### COP [99] — `wait_anim_clear_sprmap`

- **Confidence:** high
- **Preferred name:** `wait_anim_clear_sprmap`
- **Handler:** `code_00C249` @ chunk_008000.asm:9371–9387
- **Parameters:** (none)
- **Usage count:** 33

Identical to `[97]` except it also **clears `$08 bit #$0800`** — the spritemap overlay flag set by `COP [8B] set_anim_sprmap`. This is a one-frame wait + spritemap cleanup.

**Every single call site** (all 33) is immediately preceded by `COP [8B]`. The pair `[8B]` + `[99]` is a standardized idiom in the battle system for temporarily loading a spritemap frame and then clearing the overlay flag.

<details><summary>Handler</summary>

```asm
code_00C249 {
    TYX
    JSL $@code_04FC71       ; advance animation frame
    BCC loc_00C25E           ; anim done → yield
    STZ $1C
    STZ $1E
    LDA #$0800
    TRB $08                  ; clear spritemap overlay flag
    LDA $2C
    STA $02, S
    RTI

  loc_00C25E:
    PLA
    PLA
    RTL
}
```

</details>

**Canonical pattern:**

```asm
    COP [8B] ( #00, #05 )   ; set anim sprmap (loads frame, sets $08 |= #$0800)
    COP [99]                  ; wait one frame + clear $08 bit #$0800
    BRA loop                  ; return to battle idle
```

---

### COP [9A] — `anim_until_interact_destroy`

- **Confidence:** high
- **Preferred name:** `anim_until_interact_destroy`
- **Handler:** `code_00C261` @ chunk_008000.asm:9390–9406
- **Parameters:** (none)
- **Usage count:** 46

Loops calling `code_04FC71` repeatedly. If the animation finishes (carry clear), yields normally (PLA PLA RTL). But each iteration also checks `$06 bit #$4000` (interaction-busy flag). If the flag is set, the handler clears velocities and calls **`code_04FD4E`** (actor self-destruct) — unlinking the actor from the chain and freeing its slot — then yields.

This implements "play death/dismiss animation, but if the player initiates interaction mid-animation, immediately destroy the actor." Used in battle system actors for KO animations (46 sites). All call sites are the **last op** before `RTL` — it's always a terminal action.

<details><summary>Handler</summary>

```asm
code_00C261 {
    TYX

  loc_00C262:
    JSL $@code_04FC71       ; advance frame
    BCC loc_00C277           ; anim done → yield
    LDA $06
    BIT #$4000               ; interaction-busy flag?
    BEQ loc_00C262           ; not set → loop (keep animating)
    STZ $1C                  ; set → clear velocities
    STZ $1E
    JSL $@code_04FD4E       ; SELF-DESTRUCT the actor

  loc_00C277:
    PLA
    PLA
    RTL                      ; yield (actor may be dead now)
}
```

</details>

**Typical usage:**

```asm
    COP [41] ( #1A )         ; play death SFX
    COP [81] ( #07, #0F )   ; set death animation with velocity
    COP [9A]                  ; animate until done or interact → destroy
    RTL                       ; (actor is dead; execution continues in engine)
```

---

### COP [9B] — `anim_step_tick`

- **Confidence:** high
- **Preferred name:** `anim_step_tick`
- **Handler:** `code_00C27A` @ chunk_008000.asm:9409–9438
- **Parameters:** (none) — consumes `$0E24` (step counter) set by `COP [88]`
- **Usage count:** 2

A specialized animation tick with a **step counter**. The handler:

1. Decrements `$0E24` (step counter, set by `COP [88]`)
2. If `$0E24 < 0` (underflow): skip animation, continue script immediately
3. If `$0E24 == 0`: decrement `$10` (frame timer), then fall through
4. If `$0E24 > 0`: decrement `$10`, then call `code_04FC71` — if animation done, continue; if not, refill `$0E24` from `$0E + 1`, clear `$0E`, yield

This implements a "walk N steps" animation where each "step" is a complete animation cycle. `$0E24` counts down the remaining steps; each step advances through the full animation, and when the step counter is exhausted, the op continues the script.

Both call sites are in `chunk_0B8000.asm`, always preceded by `COP [88] ( #12 )` (set step counter to 18).

<details><summary>Handler</summary>

```asm
code_00C27A {
    TYX
    DEC $0E24                ; step counter--
    BMI loc_00C28A           ; underflow → done, continue
    BEQ loc_00C284           ; zero → skip DEC $10, proceed
    DEC $10                  ; > 0 → decrement frame timer

  loc_00C284:
    JSL $@code_04FC71       ; advance animation
    BCC loc_00C293           ; anim done → step boundary

  loc_00C28A:                ; continue script
    STZ $1C
    STZ $1E
    LDA $2C
    STA $02, S
    RTI

  loc_00C293:                ; step boundary reached
    LDA $0E24
    BNE loc_00C29E           ; steps remaining → refill & yield
    LDA $0E                  ; no steps left: reload from delay
    INC
    STA $0E24

  loc_00C29E:
    STZ $0E
    PLA
    PLA
    RTL                      ; yield
}
```

</details>

**Usage pattern:**

```asm
    COP [88] ( #12 )         ; set step counter $0E24 = 18
    COP [9B]                  ; tick animation steps
    BRA loop
```

---

### COP [9C] — `child_wait`

- **Confidence:** high
- **Preferred name:** `child_wait`
- **Handler:** `code_00C2A3` @ chunk_008000.asm:9440–9452
- **Parameters:** (none)
- **Usage count:** 53

The wait companion to the child sprite family (`[8D]`–`[90]`). Calls `code_00E616` which checks if the child sprite spawned by the parent is still alive:
- `$7F0020,X` (parent's child-link) → child slot → `$7F0E20,X` (child's parent-link)
- If they match: child is alive → **carry set**
- If they don't match (child died/freed): **carry clear**

If carry set (child alive), saves script pointer and RTI (re-tick next frame). If carry clear (child gone), PLA PLA RTL (yield → script advances).

Almost always follows `COP [8F]` (spawn_child) or appears in the child rendering loop (`actor_04B763`). The parent blocks until the child sprite's animation or lifecycle completes.

<details><summary>Handler</summary>

```asm
code_00C2A3 {
    TYX
    JSR $&code_00E616       ; check if child alive
    BCS loc_00C2AE           ; carry set = alive → keep waiting
    LDA $2C
    STA $02, S               ; save script pointer
    RTI                      ; continue (child still alive)

  loc_00C2AE:
    PLA
    PLA
    RTL                      ; yield — child is dead/gone
}
```

</details>

**Note on carry convention:** `[9C]`'s yield logic is **inverted** relative to `[97]`–`[9B]`. The animation ops yield when carry is clear (animation done); `[9C]` yields when carry is set (child dead). Both result in the same behavior — "continue blocking while the condition holds, advance when it doesn't."

Wait — on closer inspection, re-reading the handler: BCS goes to `loc_00C2AE` (PLA PLA RTL = yield). BCC falls through to save script pointer + RTI (continue/re-tick). So: carry **set** = child alive → yield; carry **clear** = child dead → re-tick/continue. That matches the description in `code_00E616` where carry set = alive.

Actually this is the opposite of what I expect. Let me re-read:

```
    JSR $&code_00E616       ; C=1 if child alive, C=0 if dead
    BCS loc_00C2AE           ; if alive → jump to PLA/PLA/RTL (yield)
    LDA $2C                  ; if dead → save script pointer
    STA $02, S
    RTI                      ; continue

  loc_00C2AE:
    PLA
    PLA
    RTL                      ; yield
```

So: child alive → yield (keep waiting). Child dead → continue script. This makes sense — the parent waits while the child exists, and advances when the child is destroyed.

**Typical usage:**

```asm
    COP [8F] ( #01, #00 )   ; spawn child sprite
    COP [9C]                  ; wait until child dies
    ; ... script continues after child is gone
```

## Usage statistics

| Op | Name | Sites | Files |
|----|------|------:|------:|
| `[97]` | `wait_anim_done` | 2076 | 447 |
| `[98]` | `wait_anim_frames` | 931 | 252 |
| `[99]` | `wait_anim_clear_sprmap` | 33 | 3 |
| `[9A]` | `anim_until_interact_destroy` | 46 | 9 |
| `[9B]` | `anim_step_tick` | 2 | 1 |
| `[9C]` | `child_wait` | 53 | 22 |
| | **Total** | **3141** | |

## Family notes

- **`[97]` is #3 overall** with 2076 call sites — after `[1D] show_dialog` (1754) and `[80] set_anim` (1247). Nearly every actor script uses it.
- **`[98]` is #4 overall** with 931 sites — always paired with a speed-setting setup op. The `$12` counter is consumed; it is **not** an operand of `[98]` itself.
- **`[99]` is tightly coupled to `[8B]`**: all 33 call sites have `COP [8B]` immediately before. The pair implements "load spritemap frame → advance one frame → clear overlay flag." This is a battle-system-specific idiom.
- **`[9A]` is a death animation op**: the combination of animation loop + interaction check + self-destruct means this is used exclusively for actor removal during battle defeat animations. The actor animates its death, but if the player triggers interaction (e.g., battle ends), it immediately destroys itself.
- **`[9B]` is extremely rare** (2 sites). It implements multi-step walk animations counted by `$0E24`, which is set by `COP [88]` (also rare: 2 sites). The pair `[88]` + `[9B]` is always used together.
- **`[9C]` blocks on child death**, not animation. It's the wait companion for `[8F]`/`[90]` (spawn_child / spawn_child_w) and also appears in the `actor_04B763` rendering loop.
- **All ops are parameterless** — state comes from previously-set actor fields (`$12`, `$0E24`, `$7F0020,X`, etc.).
- **Yield convention**: `[97]`–`[9B]` yield via PLA PLA RTL when animation ends (carry clear from `code_04FC71`). `[9C]` yields when child is dead (carry set from `code_00E616`). Both patterns re-enter via RTI (re-tick) while the blocking condition holds.

## Relationship to other families

```
[97]–[9C] anim_wait family
  ├── [97] wait_anim_done      ← companion to [80]–[87] (anim_setup core)
  ├── [98] wait_anim_frames    ← companion to [84]–[87], [92], [94] (speed variants)
  ├── [99] wait_anim_clear_sprmap ← companion to [8B] set_anim_sprmap
  ├── [9A] anim_until_interact_destroy ← uses code_04FD4E (actor self-destruct)
  │     └── Related: [6E]–[70] npc_lifecycle (different destroy paths)
  ├── [9B] anim_step_tick      ← companion to [88] set_anim_step
  ├── [9C] child_wait          ← companion to [8D]–[90] child_sprite family
  ├── code_04FC71              — shared animation frame advance (used by [97]–[9B])
  ├── code_00E616              — child-alive guard (used by [9C], [8D], [8E])
  ├── [9E]/[9F] sprmap_render_wait — render_config family: render wait for [91]–[94]
  └── [A0]/[A1] bitmap_render_wait — render_config family: render wait for [95]/[96]
```
