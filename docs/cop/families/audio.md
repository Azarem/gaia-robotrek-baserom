# COP family: Audio (music + SFX)

_Deep-audited ops: `[3C]`, `[3D]`, `[3E]`, `[3F]`, `[40]`, `[41]`, `[42]`, `[43]`_

[← COP overview](../index.md) · [0+ workspace](../../cop_actor_analysis.md)

## Overview

Background music queue (`$0872`/`$0870`) and SFX latch (`$0878`/`$0879` → `$APUIO2`/`$APUIO3`). Raw APU port pokes `[3F]`/`[40]` exist but are unused.

## Shared state

- `$0872` / `$0870` — music request / sticky id
- `$0876` — music DMA busy; gates SFX drain
- `$0878`/`$0879` — SFX latch word drained by NMI
- `$APUIO0`–`$APUIO3` — SNES↔SPC ports

## Family notes

- Subgroups: music `[3C]`–`[3E]`; raw unused `[3F]`/`[40]`; SFX `[41]`–`[43]`.
- Dialog `[1D]`/`[20]` yield while `$0872≠0`.

## Usage statistics

| Op | Name | Uses | Confidence | Params | Handler |
|----|------|-----:|------------|--------|---------|
| `3C` | `play_music` | 37 | high | Byte | `code_00AE64` |
| `3D` | `play_music_fade` | 7 | high | Byte | `code_00AE91` |
| `3E` | `restore_music` | 31 | high | Byte | `code_00AEBE` |
| `3F` | `apu_write_0` | 0 | high | Byte | `code_00AEF7` |
| `40` | `apu_write_1` | 0 | high | Byte | `code_00AF0B` |
| `41` | `queue_sfx_3` | 277 | high | u8 | `code_00AF1F` |
| `42` | `queue_sfx_2` | 98 | high | u8 | `code_00AF33` |
| `43` | `queue_sfx_word` | 0 | high | Word | `code_00AF47` |

**Family call-site total:** 450

## Opcodes

#### COP [3C] — `play_music` (queue BGM: hard stop then load)

- **Confidence:** high
- **Preferred name:** `play_music`
- **Aliases:** `queue_bgm`, `set_byte_reg` (old misnomer)
- **Handler:** `code_00AE64` @ `extracted/system/chunk_008000.asm:6449-6472`
- **Parameters:** `Byte` track_id (1-based)
- **Usage count:** 37

##### What it does

```asm
code_00AE64 {
    TYX
    SEP #$20
    PHX
    LDX #$000A
    JSL $@code_008297          ; queue slot = $0A
    LDY #$&code_008614         ; ★ hard-stop loader
    JSL $@code_008277          ; $00D1,X ← callback
    PLX
    REP #$20
    LDA [$2C]
    INC $2C
    AND #$00FF
    STA $0872                  ; track to play
    DEC
    CMP #$0016
    BEQ skip_sticky            ; #17 = jingle: don't clobber $0870
    STA $0870                  ; sticky = track − 1
  skip_sticky:
    ; continue (load runs async via APU queue)
}
```

Async callback `code_008614`:

1. APU handshake `$F0` (stop)
2. Index `music_list_01CA3C` with `$0872×3`
3. Upload track pointers `$4E/$50` / `$055D/$055F`, run load helpers
4. **`STZ $0872`** when done

While `$0872 ≠ 0`, dialog ops `[1D]`/`[20]` yield (busy bit — previously mislabeled “dialog sub-state”).

##### Track values

| Id | Count | Notes |
|---:|------:|-------|
| `#17` | 31 | Fanfare/jingle — **preserves** `$0870` for later restore |
| `#0F` | 2 | |
| `#03` | 2 | |
| `#01` / `#04` | 1 each | |

##### Canonical jingle → restore

```asm
COP [3C] ( #17 )              ; play fanfare (keep sticky)
COP [D0] ( #$01A4 )           ; wait ~fanfare length
COP [3E] ( #FF )              ; restore previous BGM
COP [CB]
LDA $0872
BEQ done                      ; spin until load clears $0872
RTL
```

(~28 of 31 `#17` sites use this shape.)

| Item | Value |
|------|-------|
| Suggested alias | `play_music #id` |
| APU path | `code_008614` (`$F0` stop → load) |

#### COP [3D] — `play_music_fade` (queue BGM: `$F1` then load)

- **Confidence:** high
- **Preferred name:** `play_music_fade`
- **Aliases:** `queue_bgm_fade`, `set_byte_reg_alt` (old)
- **Handler:** `code_00AE91` @ `extracted/system/chunk_008000.asm:6474-6497`
- **Parameters:** `Byte` track_id
- **Usage count:** 7

##### What it does

Identical register update to `[3C]` (`$0872` / `$0870`, `#17` sticky exception), but queues **`code_0085F6`** instead of `code_008614`:

```asm
code_0085F6 {
    LDA #$F1
    STA $APUIO0                 ; fade / alt stop command
    ; wait APU ack…
    LDA #$01
    STA $APUIO0
    ; wait clear…
    ; fall into code_008614 (same $F0 + music_list load)
}
```

Softer transition into a new track — used for scene BGM changes (`#0D` ×5, also `#0C`, `#01`).

| Item | Value |
|------|-------|
| Suggested alias | `play_music_fade #id` |
| Diff vs `[3C]` | APU `$F1` prelude before the shared loader |

- **Source examples:**
  - `fathers_house/fathers_yard/actor_07863A.asm:17` — `#0D`
  - `fathers_house/family_tomb_inner/actor_07886C.asm:17` — `#0C`
  - `unorganized/actor_09EED9.asm:32` — `#01`

#### COP [3E] — `restore_music` / set sticky + play

- **Confidence:** high
- **Preferred name:** `restore_music` (primary use `#FF`); non-`$FF` = set sticky and play `id+1`
- **Aliases:** `play_music_ex`, `set_byte_ff_mask` (old)
- **Handler:** `code_00AEBE` @ `extracted/system/chunk_008000.asm:6499-6528`
- **Parameters:** `Byte` — `#FF` restore, or sticky id
- **Usage count:** 31 (`#FF` ×30, `#0C` ×1)

##### What it does

Also queues `code_008614` (same hard loader as `[3C]`), then:

```asm
LDA [$2C]
CMP #$00FF
BNE set_pair
; #FF — restore previous track
LDA $0870
INC
STA $0872                   ; play = sticky + 1
RTS-ish continue

set_pair:
STA $0870                   ; sticky = operand
INC
STA $0872                   ; play = operand + 1
```

| Operand | Effect |
|---------|--------|
| `#FF` | `$0872 ← $0870+1` — replay track remembered before a `#17` jingle |
| `#xx` | `$0870 ← xx`, `$0872 ← xx+1` — play track `xx+1`, update sticky |

Encoding matches `[3C]`’s sticky rule (`sticky = play−1`). One non-restore site: `map_E1/actor_0888B1` uses `#0C` after a `#17` jingle (switch to track `$0D` instead of restoring).

| Item | Value |
|------|-------|
| Suggested alias | `restore_music` / `COP [3E] ( #FF )` |
| Pairs with | `[3C] #17` … wait … `[3E] #FF` |

##### Family summary (`[3C]`–`[3E]` + unused APU)

| Op | Name | APU prelude | `$0870` update |
|----|------|-------------|----------------|
| `[3C]` | `play_music` | `$F0` stop | `track−1` (skip if `#17`) |
| `[3D]` | `play_music_fade` | `$F1` then `$F0` | same as `[3C]` |
| `[3E]` | `restore_music` | `$F0` stop | `#FF` → play sticky+1; else set sticky + play sticky+1 |
| `[3F]` | `apu_write_0` | (raw `$APUIO0`) | unused in corpus |
| `[40]` | `apu_write_1` | (raw `$APUIO1`) | unused in corpus |

- **Source examples:**
  - `fathers_house/fathers_house/actor_078ACB.asm:65-67` — `#17` → wait → `#FF`
  - `prinkys_mansion/mansion_exterior/actor_06E641.asm:35-40` — same + wait `$0872==0`
  - `native_village/native_village/actor_07B7D4.asm:24,26` — `#01` then `#0F` scene music
  - `unorganized/map_E1/actor_0888B1.asm:46` — `[3E] #0C` after jingle

#### COP [3F] — `apu_write_0` (poke `$APUIO0`)

- **Confidence:** high (handler is unambiguous; **0** script sites)
- **Preferred name:** `apu_write_0`
- **Aliases:** `apu_cmd`, `write_apuio0`
- **Handler:** `code_00AEF7` @ `extracted/system/chunk_008000.asm:6530-6541`
- **Parameters:** `Byte` value → `$APUIO0` (`$2140`)
- **Usage count:** 0 (not in `us/copdef.json`; jump-table slot exists)

##### What it does

```asm
code_00AEF7 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    SEP #$20
    STA $APUIO0             ; SNES↔SPC port 0
    REP #$20
    LDA $2C
    STA $02, S
    RTI
}
```

Raw write to the **primary APU command port**. No handshake, no queue, no wait for ack.

Known values the engine itself sends on `$APUIO0` (from `[3C]`–`[3E]` loaders / SPC upload):

| Value | Context |
|------:|---------|
| `$F0` | Stop / prepare load (`code_008614`) |
| `$F1` | Fade prelude (`code_0085F6` / `[3D]`) |
| `$FF` | Transfer marker during track upload |
| `$01` | Post-load / resume handshake |
| other | Track / SFX command bytes during transfer |

`[3F]` would let a script issue those (or any) commands **directly**, bypassing the `$00D0`/`$00D1` music queue used by `[3C]`–`[3E]`.

##### Why unused

- Absent from `copdef.json` → extractor never emits `COP [3F]` even if bytes existed
- No matches under `extracted/**/*.asm`
- Shipped scripts use the queued music ops (`[3C]`/`[3D]`/`[3E]`) and SFX latch ops (`[41]`/`[42]` → `$APUIO2`/`3`) instead

Likely a debug / low-level escape hatch left in the dispatch table.

| Item | Value |
|------|-------|
| Suggested alias | `apu_write_0 #cmd` |
| Risk | Can desync SPC if used without matching ack protocol |

#### COP [40] — `apu_write_1` (poke `$APUIO1`)

- **Confidence:** high (handler clear; **0** script sites)
- **Preferred name:** `apu_write_1`
- **Aliases:** `write_apuio1`
- **Handler:** `code_00AF0B` @ `extracted/system/chunk_008000.asm:6543-6554`
- **Parameters:** `Byte` value → `$APUIO1` (`$2141`)
- **Usage count:** 0 (not in `us/copdef.json`; jump-table slot exists)

##### What it does

```asm
code_00AF0B {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    SEP #$20
    STA $APUIO1             ; SNES↔SPC port 1
    REP #$20
    LDA $2C
    STA $02, S
    RTI
}
```

Identical shape to `[3F]`, targeting **port 1**.

Engine use of `$APUIO1` (not via this COP): during SPC data upload (`chunk_048000` `code_0491D6` / `049212`) it carries a 0/1 transfer flag derived from block size (`CPX #$0001` / `ROL`), then is `STZ`’d when the block finishes. `$APUIO2`/`$APUIO3` carry payload words alongside.

So `[40]` is the script-level poke for that secondary port — again unused in extracted actors.

##### Family note (`[3F]`–`[43]`)

Adjacent audio ops, different layers:

| Op | Target | Level |
|----|--------|-------|
| `[3C]`–`[3E]` | Music queue → APU protocol | High-level BGM |
| `[3F]` | `$APUIO0` | Raw port 0 (unused) |
| `[40]` | `$APUIO1` | Raw port 1 (unused) |
| `[41]` | `$0879` → `$APUIO3` | Queued SFX high byte |
| `[42]` | `$0878` → `$APUIO2` | Queued SFX low byte |
| `[43]` | `$0878` word → both ports | Queued SFX word (unused) |

| Item | Value |
|------|-------|
| Suggested alias | `apu_write_1 #val` |
| Copdef | Missing — add `"3F"/"40": { "parts": ["Byte"] }` if re-enabling |

#### COP [41] — `queue_sfx_3` (queue SFX high byte → `$APUIO3`)

- **Confidence:** high (handler + NMI drain path)
- **Preferred name:** `queue_sfx_3`
- **Aliases:** `play_sfx_hi`, `sfx_apuio3`, `set_0879`
- **Handler:** `code_00AF1F` @ `extracted/system/chunk_008000.asm:6522-6533`
- **Parameters:** `Byte` sfx / command id
- **Usage count:** 277 (34 distinct values)
- **Pairs with:** `[42]` (low byte); drained together as a word by NMI

##### What it does

```asm
code_00AF1F {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    SEP #$20
    STA $0879               ; high byte of SFX latch word
    REP #$20
    LDA $2C
    STA $02, S
    RTI
}
```

Writes **only** `$0879`. The next NMI that drains the latch (see below) copies the full word `$0878`/`$0879` into `$APUIO2`/`$APUIO3`, then clears both bytes. So a lone `[41] (#13)` with `$0878==0` becomes APU command `#$1300` (port2=`$00`, port3=`$13`).

Engine helpers that do the same write: `code_00FECA` (`STA $0879` from `A`), plus many direct `STA $0879` sites in menus / map load (`#$1C`, `#$09`, `#$29`, `#$16`, …).

##### How the latch reaches the SPC

`code_0BFB43` (NMI / frame IRQ in `chunk_0B8000.asm`):

```asm
; excerpt — only when music latch $0876 == 0
LDA $30
LSR
LDA #$0000
BCS send                    ; odd frames: push 0 (handshake)
LDA $0878                   ; even frames: 16-bit load of lo+hi
STZ $0878                   ; consume latch
send:
STA $APUIO2                 ; → $2142 (lo) + $2143 (hi)
```

| Gate | Effect |
|------|--------|
| `$0876 ≠ 0` (or BMI) | Music upload owns APUIO — **SFX drain skipped** |
| Frame `$30` odd | Sends `#$0000` (keeps SPC handshake alive) |
| Frame `$30` even | Sends pending latch, then `STZ $0878` |

Music finish (`code_008614` tail) also `STY $0878` / `STY $0876` / `STY $0872` (clears SFX latch with the music state).

##### Why / how used

Most common “play a UI / scene sound” op. Typical after dialog, flag set, or cutscene beat:

```asm
COP [1D] ( &string_078CDB )
COP [41] ( #13 )              ; confirm / talk SFX on port 3
COP [0A] ( #$8001 )
```

Top operands (277 sites):

| Byte | Count | Typical context |
|------|------:|-----------------|
| `#13` | 34 | Dialog / confirm beeps |
| `#27` | 32 | Cutscene / impact |
| `#10` | 25 | Generic cue (also common on `[42]`) |
| `#0B` | 23 | Short blip |
| `#26` | 17 | Combat / system actors |
| `#1B` `#22` `#15` `#23` … | | Scene-specific |

Scripts occasionally pair both ports in one beat (`[42]` then `[41]`, or the reverse with a delay) so the NMI word carries a non-zero lo **and** hi.

| Item | Value |
|------|-------|
| Suggested alias | `queue_sfx_3 #id` / `play_sfx_hi #id` |
| Latency | Up to ~2 frames (even-frame drain + `$0876` gate) |
| Does not | Wait for SPC ack; does not touch `$APUIO0`/`1` |

- **WRAM:** `$0879` (and later NMI clears `$0878` word)
- **Source examples:**
  - `fathers_house/fathers_house/actor_078ACB.asm:50` — `#13` after dialog
  - `fathers_house/fathers_yard/actor_0787B0.asm:16` — `#10`
  - `rococo/rococo/actor_058022.asm:25` — `#08` on knock / empty house
  - `hacker_fortress/fortress_escape/actor_04E438.asm:41,46` — `#13` then `#2C`
  - `native_village/island_inlet/actor_07F32A.asm:21` — `#28`
  - `prinkys_mansion/mansion_tower2_center/actor_06B52E.asm:14` — `#07` in blink loop

#### COP [42] — `queue_sfx_2` (queue SFX low byte → `$APUIO2`)

- **Confidence:** high
- **Preferred name:** `queue_sfx_2`
- **Aliases:** `play_sfx_lo`, `sfx_apuio2`, `set_0878`
- **Handler:** `code_00AF33` @ `extracted/system/chunk_008000.asm:6535-6546`
- **Parameters:** `Byte` sfx / command id
- **Usage count:** 98 (18 distinct values)
- **Pairs with:** `[41]` (high byte); same NMI drain as above

##### What it does

```asm
code_00AF33 {
    TYX
    LDA [$2C]
    INC $2C
    AND #$00FF
    SEP #$20
    STA $0878               ; low byte of SFX latch word
    REP #$20
    LDA $2C
    STA $02, S
    RTI
}
```

Symmetric to `[41]`, but targets **`$0878`** (becomes `$APUIO2`). Lone `[42] (#10)` with `$0879==0` → APU word `#$0010`.

Same-write helper: `code_00FED2`. Engine also `STY $0878` (16-bit clear) when music load completes.

##### Why / how used

World / mechanical cues more often than UI beeps. Example — door / empty-house exit:

```asm
COP [4D] ( #00, #$FD00 )
COP [42] ( #10 )              ; whoosh / step SFX on port 2
COP [33] ( #$FF50 )
COP [B2]
```

Combat UI polls the latch before re-queueing (wait until NMI consumed prior SFX):

```asm
; chunk_048000 code_04C7… — while aiming
LDA $0878
BIT #$00FF
BNE retry                     ; still pending
COP [42] ( #0F )              ; fire next tick SFX
```

Top operands (98 sites):

| Byte | Count |
|------|------:|
| `#10` | 28 |
| `#0C` | 10 |
| `#13` | 8 |
| `#1F` | 7 |
| `#23` `#0F` | 6 each |

| Item | Value |
|------|-------|
| Suggested alias | `queue_sfx_2 #id` / `play_sfx_lo #id` |
| Relation | Same latch/NMI path as `[41]`; choose port by design (SPC firmware) |

- **WRAM:** `$0878`
- **Source examples:**
  - `rococo/rococo/actor_058022.asm:38` — `#10` after `[4D]`
  - `prinkys_mansion/mansion_tower2_center/actor_06B52E.asm:86,98` — `#0C` / `#0B`
  - `prinkys_mansion/mansion_exterior/actor_06DA20.asm:13` — `#10`
  - `volcano_base/volcano_cave_tremors/actor_07ECD8.asm:35,82,103` — `#1F` / `#13`
  - `rococo/tunnel_entrance/actor_05F686.asm:61` — `#10`

#### COP [43] — `queue_sfx_word` (queue full SFX latch word)

- **Confidence:** high (handler unambiguous; **0** script sites)
- **Preferred name:** `queue_sfx_word`
- **Aliases:** `set_sfx_word`, `sfx_apuio23`, `set_0878_word`
- **Handler:** `code_00AF47` @ `extracted/system/chunk_008000.asm:6548-6557`
- **Parameters:** `Word` — both `$0878` (lo) and `$0879` (hi) in one store
- **Usage count:** 0 (not in `us/copdef.json`; jump-table slot exists)

##### What it does

```asm
code_00AF47 {
    TYX
    LDA [$2C]
    INC $2C
    INC $2C                   ; consume Word operand
    STA $0878                 ; 16-bit: lo→$0878, hi→$0879
    LDA $2C
    STA $02, S
    RTI
}
```

One-shot equivalent of `[42]` + `[41]` without an intervening frame. Would author as e.g. `COP [43] ( #$1005 )` for lo=`#$05`, hi=`#$10`.

##### Why unused

- Missing from `copdef.json` → extractor never emits it
- No `COP [43]` under `extracted/**/*.asm`
- Scripts that need both bytes issue `[41]`/`[42]` separately (sometimes with `[D0]` between)

| Item | Value |
|------|-------|
| Suggested alias | `queue_sfx_word #$hilo` |
| Copdef | Add `"43": { "parts": ["Word"] }` if re-enabling |

##### Family summary (`[41]`–`[43]` SFX queue)

| Op | Name | Writes | APU ports after NMI |
|----|------|--------|---------------------|
| `[41]` | `queue_sfx_3` | `$0879` | `$APUIO3` |
| `[42]` | `queue_sfx_2` | `$0878` | `$APUIO2` |
| `[43]` | `queue_sfx_word` | `$0878` word | both |

Shared path: latch → (even frame, `$0876==0`) → `STA $APUIO2` → `STZ $0878`. Distinct from music (`[3C]`–`[3E]` / `$0872`) and from raw pokes (`[3F]`/`[40]`).
