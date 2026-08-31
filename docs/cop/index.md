# Robotrek COP system overview

_Canonical docs for deep-audited COP `$00`–`$57`. Family pages live under [`families/`](families/). Continued `$58+` analysis lives in [`cop_actor_analysis.md`](../cop_actor_analysis.md)._

## Overview

Robotrek scene logic is driven by **actors**: small scripted objects with a 5-byte header and a body of 65816 code that invokes the **COP** (Coprocessor / script) instruction. COP opcodes are dispatched through `code_009EE8` → jump table `code_list_009F10` in `extracted/system/chunk_008000.asm`. Operand layouts are declared in `us/copdef.json` (note: `[3F]`/`[40]`/`[43]`/`[4F]`/`[14]`–`[16]` exist in the jump table but are missing from copdef). Scene spawn lists live in `extracted/system/script_meta_028000.asm`.

- Actor definitions found: **866**
- Actor files scanned: under `extracted/` (`.asm`)
- COP opcodes defined in copdef.json: **231**
- Jump-table slots: **251** (including unused/`#$FFFF`)
- Script-meta scene blocks (`unk1_*`): **454**
- Script-meta pointer-table entries: **500** (456 non-null)


## Scope of this split

| Item | Value |
|------|-------|
| Deep-audited opcodes | `$00`–`$57` (88 slots) |
| Call sites (sum of per-op counts) | **11427** |
| Family documents | 19 |
| `$58+` workspace | [`docs/cop_actor_analysis.md`](../cop_actor_analysis.md) |

## Instruction families (`$00`–`$57`)

Families are grouped by **shared handlers / memory**, not by jump-table order. Several false neighbors are called out below.

| Family | Ops | Doc | Uses |
|--------|-----|-----|-----:|
| **Control flow** | `00` `01` `02` `03` `04` `05` `06` `07` `09` `27` | [control_flow.md](families/control_flow.md) | 1037 |
| **Event flags** | `08` `0A` `0B` `0C` `0D` `1B` | [event_flags.md](families/event_flags.md) | 2263 |
| **Proximity / player position** | `0E` `0F` `10` `11` `12` `13` `14` `15` `16` | [proximity.md](families/proximity.md) | 308 |
| **Map / placement** | `17` `18` `19` `1A` | [map_placement.md](families/map_placement.md) | 362 |
| **Dialog / choice** | `1C` `1D` `1E` `1F` `20` `21` | [dialog.md](families/dialog.md) | 2049 |
| **Interact hooks** | `22` `23` | [interact.md](families/interact.md) | 563 |
| **BG tile attributes** | `24` | [bg_tile_attrs.md](families/bg_tile_attrs.md) | 60 |
| **Switch tables** | `25` `26` | [switch.md](families/switch.md) | 19 |
| **Wander / step profile** | `28` `29` `2A` | [wander.md](families/wander.md) | 99 |
| **Party follow** | `2B` `2C` `2D` `2E` | [party_follow.md](families/party_follow.md) | 57 |
| **Chase / herd** | `2F` `30` | [chase.md](families/chase.md) | 3 |
| **RNG** | `31` | [rng.md](families/rng.md) | 89 |
| **UI focus** | `32` | [ui_focus.md](families/ui_focus.md) | 146 |
| **Input / pad** | `33` `34` `35` `36` `37` `38` `39` `3A` `3B` | [input.md](families/input.md) | 838 |
| **Audio (music + SFX)** | `3C` `3D` `3E` `3F` `40` `41` `42` `43` | [audio.md](families/audio.md) | 450 |
| **Collision / solid** | `44` `45` `46` `47` `48` `49` | [collision.md](families/collision.md) | 905 |
| **Metatile id (branch + write + scan)** | `4A` `4B` `4C` `4D` `4E` `4F` `50` | [metatiles.md](families/metatiles.md) | 272 |
| **Movement / walk steps** | `51` `52` `53` `54` `55` | [movement.md](families/movement.md) | 1851 |
| **Tracked IDs** | `56` `57` | [tracked_ids.md](families/tracked_ids.md) | 56 |

### Why these family boundaries

- **Control flow** (`00`, `01`, `02`, `03`, `04`, `05`, `06`, `07`, `09`, `27`): Script subroutine call/return, counted repeats, far goto, and player script hijack. These ops move the per-actor script PC (`$2C`/`$2A`) and use return slots in `$7F001A` / `$7F001C`/`$1E` / `$7F0024`.
- **Event flags** (`08`, `0A`, `0B`, `0C`, `0D`, `1B`): Read/write the story bitfield at `$0730+` via `code_00DBEF` (test) and `code_00DBBD` (set/clear). Includes wait, single/multi branch, rewards, and the map-adjacent `[1B]` reset helper. Largest non-movement family by call-site count.
- **Proximity / player position** (`0E`, `0F`, `10`, `11`, `12`, `13`, `14`, `15`, `16`): Branch when the player (or another actor) matches a geometric / facing test. Handlers read globals filled by `code_00FA5E` (`$0BA6`/`$0BA8`/`$0BAA`), not the player actor directly. Covers AABB, exact cell, axis-only, and relative-to-self variants.
- **Map / placement** (`17`, `18`, `19`, `1A`): Teleport the current actor, request/queue map loads, and branch on the current map id (`$05A8`). Often paired with collision `[44]` after teleport. `[18]` is the primary transition; `[19]` stages an alternate/deferred request.
- **Dialog / choice** (`1C`, `1D`, `1E`, `1F`, `20`, `21`): Show dialog strings and present choice menus — the second-largest family by usage. Variants differ by bank, yield policy, and whether music-busy (`$0872≠0`) stalls the script before text starts.
- **Interact hooks** (`22`, `23`): Install the script the player invokes when talking to / activating this actor. Dispatch lives in `code_0BE478` (player host).
- **BG tile attributes** (`24`): Paint attribute bits into the WRAM tilemap buffer `$7EF000` / `$7EF040`. Unrelated to switch tables `[25]`/`[26]` despite adjacent opcodes.
- **Switch tables** (`25`, `26`): Jump tables over an actor byte. `[25]` switches on spawn/focus param `$04`; `[26]` switches on actor-local counter `$22`.
- **Wander / step profile** (`28`, `29`, `2A`): Random walk inside a cell rectangle, optional custom walk/bounce anim bases, and the move-profile byte consumed by the shared step helpers.
- **Party follow** (`2B`, `2C`, `2D`, `2E`): Recruit / claim a follower slot and step toward the player track tables. Max **6** followers via `$09C8` bits.
- **Chase / herd** (`2F`, `30`): Independent chase AI toward the player using a separate slot pool (max **8**), not the party-follower tables.
- **RNG** (`31`): Advance the LFSR over `$0529`–`$0538`. Scripts read `$052A` afterward. Also called internally by wander `[28]`.
- **UI focus** (`32`): Claim UI / script focus by writing `#$01xx` into actor `$04` and global `$0B70`. Gated for actors with `$06` bit `$8000`.
- **Input / pad** (`33`, `34`, `35`, `36`, `37`, `38`, `39`, `3A`, `3B`): Pad inhibit masks, handler vector install/dispatch, and wait/branch on live pad bits. Covers the full input stack used by cutscenes and menus.
- **Audio (music + SFX)** (`3C`, `3D`, `3E`, `3F`, `40`, `41`, `42`, `43`): Background music queue (`$0872`/`$0870`) and SFX latch (`$0878`/`$0879` → `$APUIO2`/`$APUIO3`). Raw APU port pokes `[3F]`/`[40]` exist but are unused.
- **Collision / solid** (`44`, `45`, `46`, `47`, `48`, `49`): Occupy or vacate cells in `$7FA000`, and probe terrain / blocked state. High nibble `#$F0` = actor solid; low nibble = terrain type.
- **Metatile id (branch + write + scan)** (`4A`, `4B`, `4C`, `4D`, `4E`, `4F`, `50`): Branch on or rewrite per-cell metatile ids in `$7EA000`, with graphics from `$7E2000+id×8` and collision refresh via `code_0AF5A4`. `[50]` cooperatively redraws a rectangle row-by-row.
- **Movement / walk steps** (`51`, `52`, `53`, `54`, `55`): Scripted walk packets and the shared step bracket (`[51]` begin / `[52]` end). Wander `[28]`/`[29]` consumes the same bracket.
- **Tracked IDs** (`56`, `57`): Claim/release globally tracked instance ids in `$7E4102` / `$7E4192`.

### False neighbors (do not merge)

| Adjacent opcodes | Why they are different families |
|------------------|----------------------------------|
| `[08]` ↔ `[09]` ↔ `[0A]` | wait/branch flags vs **far goto** vs set_flag |
| `[1A]` ↔ `[1B]` | map id test vs **flag reset** + `$0553` |
| `[24]` ↔ `[25]` | BG attr paint vs **switch tables** |
| `[27]` ↔ `[28]` | player script hijack vs **wander** |
| `[2E]` ↔ `[2F]` | party follow vs **chase/herd** pools |
| `[30]` ↔ `[31]` ↔ `[32]` | chase anim vs **RNG** vs **UI focus** |
| `[3E]` ↔ `[41]` | music vs SFX (same audio doc; different ports/latches) |
| `[49]` ↔ `[4A]` | `$7FA000` collision probe vs `$7EA000` metatile branch |
| `[4F]` ↔ `[50]` ↔ `[51]` | unused refresh vs **row scan** vs **step_begin** |
| `[55]` ↔ `[56]` | walk_seeks vs **claim_id** tables |

## Top opcodes by usage (`$00`–`$57`)

| Rank | Op | Name | Uses | Family |
|-----:|----|------|-----:|--------|
| 1 | `1D` | `show_dialog` | 1754 | [dialog](families/dialog.md) |
| 2 | `0A` | `set_flag` | 1077 | [event_flags](families/event_flags.md) |
| 3 | `0B` | `branch_if_flag` | 863 | [event_flags](families/event_flags.md) |
| 4 | `51` | `step_begin` | 662 | [movement](families/movement.md) |
| 5 | `52` | `step_end` | 662 | [movement](families/movement.md) |
| 6 | `22` | `set_interact` | 560 | [interact](families/interact.md) |
| 7 | `44` | `solid_on` | 453 | [collision](families/collision.md) |
| 8 | `34` | `mask_input` | 337 | [input](families/input.md) |
| 9 | `54` | `walk_to_y` | 281 | [movement](families/movement.md) |
| 10 | `33` | `unmask_input` | 278 | [input](families/input.md) |
| 11 | `41` | `queue_sfx_3` | 277 | [audio](families/audio.md) |
| 12 | `05` | `repeat_begin` | 233 | [control_flow](families/control_flow.md) |
| 13 | `06` | `repeat_yield` | 219 | [control_flow](families/control_flow.md) |
| 14 | `0C` | `branch_if_flags` | 214 | [event_flags](families/event_flags.md) |
| 15 | `1F` | `show_dialog_now` | 213 | [dialog](families/dialog.md) |
| 16 | `45` | `solid_off` | 213 | [collision](families/collision.md) |
| 17 | `53` | `walk_to_x` | 202 | [movement](families/movement.md) |
| 18 | `27` | `queue_player_script` | 167 | [control_flow](families/control_flow.md) |
| 19 | `32` | `set_focus_id` | 146 | [ui_focus](families/ui_focus.md) |
| 20 | `10` | `branch_if_at_xy_facing` | 145 | [proximity](families/proximity.md) |
| 21 | `46` | `solid_on_at` | 145 | [collision](families/collision.md) |
| 22 | `00` | `gosub` | 143 | [control_flow](families/control_flow.md) |
| 23 | `50` | `redraw_tile_rows` | 128 | [metatiles](families/metatiles.md) |
| 24 | `17` | `teleport_xy_facing` | 127 | [map_placement](families/map_placement.md) |
| 25 | `18` | `request_map` | 127 | [map_placement](families/map_placement.md) |


## Zero-use / missing-copdef slots in range

| Op | Name | Notes |
|----|------|-------|
| `14` | `branch_if_rel_x_facing` | uses=0; params=(not in copdef; unused) |
| `15` | `branch_if_rel_y_facing` | uses=0; params=(not in copdef; unused) |
| `16` | `branch_if_actor_at_xy` | uses=0; params=Byte×4, &Code (not in copdef; unused) |
| `3F` | `apu_write_0` | uses=0; params=Byte (not in copdef) |
| `40` | `apu_write_1` | uses=0; params=Byte (not in copdef) |
| `43` | `queue_sfx_word` | uses=0; params=Word (not in copdef; unused) |
| `4F` | `refresh_tile_at` | uses=0; params=Byte, Byte (not in copdef; unused) |

## Memory map (script / actor relevant)

Addresses below are those most frequently touched by COP handlers and actor scripts. Direct page / absolute WRAM unless noted.

### Script engine (per running actor)

| Address | Role (inferred) | Evidence |
|---------|-----------------|----------|
| `$2C` / `$2E` | Script read pointer (24-bit via `[ $2C ]`) | COP dispatcher `code_009EE8` loads opcode from `[$2C]`, handlers `INC $2C` |
| `$28` | Resume / next PC when yielding | Many wait handlers `STA $28` then `PLA PLA RTL` |
| `$2A` | Script bank byte (far calls/gotos) | `gosub_far` / `goto_far` (`COP [03]` / `[09]`) |
| `$30`, `$32` | Script temps — `[0C]` flag accum; **`[48]`/`[49]` leave tile/blocked result in `$30`** | Also used by solid helpers as scratch |
| Stack `$02,S` / `$04,S` | Return PC / bank patched by COP | `STA $02,S` pattern in call/jump ops |

### Per-actor RAM (`$7Fxxxx,X` — X = actor index/slot)

| Offset | Role (inferred) | Used by |
|--------|-----------------|---------|
| `$7F001A,X` | **Single-level near gosub return** (also reused by `[27]` / `[37]`) | `COP [00]`/`[01]` primarily |
| `$7F001C,X` / `$7F001E,X` | **Far gosub return PC / bank** | `COP [03]`/`[04]` |
| `$7F000C,X` | Current animation id | `COP [80]`/`[84]`/`[85]`/`[86]` |
| `$7F0012,X` / `$7F0014,X` | Footprint W/H (tiles) for solid ops; also step/walk temps | `[44]`–`[49]` if `W+H≥3`; `[51]`/`[52]` |
| `$7F000E,X` / `$7F0010,X` | Footprint origin offsets (multi-tile solid paint/probe) | `[44]`–`[49]` large path |
| `$7F0020,X` (= DP `$20`) | **Multipurpose actor word** — chase-slot index for `[2F]`/`[30]`; also general counter (credits wait/`INC $20`) | Scripts + chase claim |
| `$7F0022,X` | Parent actor link for spawned children | `COP [AA]` family |
| `$7F0024,X` | **Main/idle resume PC** *or* **repeat loop head** (shared!) | `COP [02]` returns here; `[05]` writes head; `[06]`/`[07]` rewind |
| `$7F0026,X` | Repeat remaining count | `COP [05]`/`[06]`/`[07]` |
| `$7F0028,X` | **Primary interact / talk script** (`&Code`) | `COP [22]`; dispatched by `code_0BE478` |
| `$7F2032,X` | **Alternate interact script** (companion `$004C` mode) | `COP [23]`; fallback in `code_0BE478` |
| `$7F101A,X` | **Move / step profile** (velocity-table band select) | `COP [2A]`; consumed by `code_00E3BA` / `code_00E420` |
| `$7F101C,X` | Movement table base (copied from player on `[2C]` join) | Wander / follow step helpers |
| `$7F1028,X` | **Follower slot index** (×2 into `$09CA`/`$09D6`) | `COP [2C]` claim; `[2D]` follow |
| `$7F0DF0,X` / `$7F0E08,X` | Animation table pointers (player controller) | `actor_04B763` |

#### `$7F` offsets referenced by COP handlers (by # of opcodes)

| Address | #opcodes |
|---------|----------|
| `$7F000C` | 31 |
| `$7F0022` | 23 |
| `$7F0008` | 13 |
| `$7F0000` | 8 |
| `$7F0002` | 8 |
| `$7F0028` | 6 |
| `$7F101A` | 6 |
| `$7F200E` | 6 |
| `$7F001A` | 5 |
| `$7F2002` | 5 |
| `$7F0024` | 4 |
| `$7F101C` | 4 |
| `$7F002C` | 4 |
| `$7F1030` | 4 |
| `$7F1032` | 4 |
| `$7F0D30` | 4 |
| `$7F0DF0` | 4 |
| `$7F0E08` | 4 |
| `$7F0032` | 4 |
| `$7F0034` | 4 |
| `$7F0026` | 3 |
| `$7F1028` | 3 |
| `$7F002A` | 3 |
| `$7F0020` | 3 |
| `$7F002E` | 3 |
| `$7F0030` | 3 |
| `$7F100C` | 3 |
| `$7F000E` | 3 |
| `$7F0016` | 3 |
| `$7F001C` | 2 |
| `$7F001E` | 2 |
| `$7F0012` | 2 |
| `$7F0014` | 2 |
| `$7F1036` | 2 |
| `$7F0D48` | 2 |
| `$7F0DD8` | 2 |
| `$7F0E20` | 2 |
| `$7F0D60` | 2 |
| `$7F2010` | 2 |
| `$7F0036` | 2 |

### Global WRAM frequently used by scripts

| Address | Notes |
|---------|-------|
| `$05EE` | Temp for special flag set (`COP [0D]`) |
| `$056E` | **Pad input inhibit mask** — bits set here are stripped from `$0560` each frame | `[34]` set / `[33]` clear; poller `chunk_048000` |
| `$0560` / `$0562` | Live pad bits / post-mask pad snapshot | Built from `$0566` + remaps; `[34]` also `TRB`s |
| `$056A` | **Pad ack / consume mask** — bits here are `TRB`'d from `$0560` next poll | `[39]` / `[37]` write; poller clears |
| `$0574`–`$058B` | **12 pad-handler vectors** (word each) | `[35]` patch; `[36]` bulk install; `[37]` dispatch |
| `$0572` | Pad bits eligible for `[37]` dispatch (`AND` mask) | Loaded from unk21 trailer |
| `$0730+` | **Event flag bitfield** (tested by `code_00DBEF`, set/cleared by `code_00DBBD`) |
| `$0610` / `$05F2` | Dialog mode / saved mode during text (`[1D]`/`[1F]`/`[20]`) |
| `$0ECE` | Dialog-busy latch per slot — `[1D]`/`[20]` yield; `[1C]` clears |
| `$05AE` | Textbox active — `[1D]`/`[20]` yield when set |
| `$0872` | **Music track request id** (1-based `music_list` index); `[1D]`/`[20]` yield while ≠0 | `[3C]`/`[3D]`/`[3E]`; cleared when APU load finishes |
| `$0870` | Sticky music id (`play−1`) for `[3E] #FF` restore | `[3C]`/`[3D]`/`[3E]` |
| `$0876` | Music/DMA busy latch — when ≠0, NMI skips SFX port drain | Set during track upload; cleared when load finishes |
| `$0878` / `$0879` | **SFX latch word** (lo/hi) — NMI copies to `$APUIO2`/`$APUIO3` then `STZ` | `[42]` lo / `[41]` hi / `[43]` word; helpers `code_00FED2`/`code_00FECA` |
| `$0EEC` | Last choice index (×2 → `&&Code` list) for `[1C]`/`[1E]` |
| `$06` | Actor/engine flags (`TSB`/`TRB`, e.g. `#$2000` interaction) |
| `$00` / `$02` | Actor sprite X / Y (`≈ cell+8` / `≈ cell+16`) |
| `$04` | Actor instance / spawn param — also **focus id** when set by `[32]` (`#$01xx`) | `COP [25]` switch; `[32]` + `$0B70` |
| `$22` | Actor-local counter / mode — `COP [26]` switch; scripts `INC`/`STZ` |
| `$20` | Same as `$7F0020` — chase-slot index (`ASL $09E2`) for `[2F]`/`[30]`, else free actor scratch | See chase / credits patterns |
| `$0C` | Facing / step direction bits (`0`–`3` typical) | Snapshotted to `$0BAA` for proximity COPs |
| `$0E` | Delay countdown (`COP [D0]`) |
| `$10` / `$12` | Anim progress / frame counter |
| `$1C` / `$1E` | Anim velocity / delta X/Y |
| `$0BA6` / `$0BA8` | **Player cell X / Y** (`player.$00−8`, `player.$02−16`) | `[0E]`–`[15]` proximity family |
| `$0BB2` / `$0BB4` | Player cell X/Y `>>4` (coarse) | Set alongside `$0BA6`/`$0BA8` in `code_00FA5E` |
| `$0BAA` | **Player facing** (copy of player `$0C`) | Facing filter on `[0E]`/`[0F]`/`[10]`/… |
| `$05A8` | **Current map / scene id** (`COP [1A]` / `branch_if_map`) | Loaded from pending `$05A6` |
| `$0553` | Sticky latch cleared by `COP [1B]` (and a few system paths) | No reads found in extract |
| `$05A6` | **Pending map id** for next load (`COP [18]`); cleared when consumed | → `$05A8` / `$05AA` on transition |
| `$05AC` / `$05B6` | Entrance / transition mode + param | `[18]`; `$05AC` dispatches `code_0097F8` |
| `$05BA` / `$05BE` | Primary camera / spawn cell X/Y | `[18]`; used by follow logic `code_00F9BD` |
| `$05BC` / `$05C0` | Alternate camera target X/Y (non-zero → prefer over BA/BE) | Cleared by `[18]`; set via `[19]` apply path |
| `$05E8`, `$05E0`–`$05E6` | **Deferred / alt** map-request block (`COP [19]`) | Promoted later (`code_008869` / combat return) |
| `$0EEE` | **Player actor slot** (index into actor pool) | `[27]` targets this; set by player host |
| `$0004` / `$0006` | **Absolute scratch** for step anim bias — *not* DP actor `$04`/`$06` | `[28]`/`[29]` wander; `[2E]`/`[30]` follow/chase |
| `$09C8` | **Follower occupancy bitmask** (bits 0–5, max 6) | `[2C]` claim / `[2D]`/`[2E]` release |
| `$09CA` / `$09D6` | Follower track X/Y words (indexed by `$7F1028`) | Updated from player `$0BB6`/`$0BB8` |
| `$09E2` | **Chase-slot count** (0–8) | `[2F]` / `[30]` herd AI |
| `$09E4+` | Per-chase-slot pathfinding state (facing + blocked dirs) | `[2F]`/`[30]` via actor `$20` |
| `$0BAC` / `$0BAE` | Player move mode / move profile (mirrored into follower) | `[2D]`/`[2E]` step |
| `$0529`–`$0538` | PRNG state (LFSR); `$052A` = latest random byte | `[31]` ticks; `[28]` wander also calls PRNG |
| `$0B70` | **UI / script focus id** (`#$01xx`) — must match actor `$04` | `[32]` claims; gate in `code_00E7F2` |
| `$7EF000` | Tilemap attribute buffer (`COP [24]`) |
| `$7EA000` | **Per-cell tile / metatile id** (raw map byte) | `[4A]`/`[4B]` compare; `[4C]`/`[4D]` write; `[4E]`/`[4F]` leave unchanged |
| `$7E2000` | **Metatile graphics table** — 8 bytes (4 words) per tile id | `code_0AF5A4` indexes `id×8` when queueing BG |
| `$7FA000` | **Collision / occupancy map** — lo nibble = terrain type; hi `#$F0` = actor solid | `[44]`–`[49]`; also set from tile-id table by `code_0AF5A4` |
| `$095E` | **BG / tile-update queue cursor** (bytes); `≥$80` → tile-write COPs yield | Advanced by `code_0AF5A4`; drained/cleared in `chunk_0B8000` |

Top absolute `$xxxx` refs in actor/script ASM:

| Addr | Count |
|------|-------|
| `$0000` | 348 |
| `$0006` | 187 |
| `$0002` | 179 |
| `$09C0` | 120 |
| `$0B7A` | 117 |
| `$052A` | 109 |
| `$0B7E` | 108 |
| `$0004` | 96 |
| `$0BA2` | 85 |
| `$056E` | 72 |
| `$0B82` | 70 |

Top `$7Fxxxx` refs in actor/script ASM:

| Addr | Count |
|------|-------|
| `$7F000C` | 69 |
| `$7F0022` | 59 |
| `$7FA000` | 55 |
| `$7F0000` | 44 |
| `$7F0008` | 44 |
| `$7F0002` | 37 |
| `$7F1030` | 35 |
| `$7F1032` | 33 |
| `$7F0012` | 31 |
| `$7F0014` | 29 |
| `$7F100C` | 25 |
| `$7F1000` | 24 |
| `$7FD000` | 23 |
| `$7F000E` | 22 |
| `$7F101A` | 20 |
| `$7F2002` | 20 |
| `$7F1012` | 20 |
| `$7F001A` | 19 |
| `$7F101C` | 17 |
| `$7F002C` | 17 |
| `$7F1020` | 17 |
| `$7F1018` | 17 |
| `$7F100E` | 17 |
| `$7F001C` | 16 |
| `$7F0010` | 15 |
| `$7F0C2E` | 14 |
| `$7F0E20` | 13 |
| `$7F0020` | 13 |
| `$7F0028` | 13 |
| `$7F2014` | 13 |

### Movement / step (see [movement.md](families/movement.md))

| Address | Role |
|---------|------|
| `$0C` bit15 | Step in progress (`[51]` set / `[52]` clear) |
| `$1C` / `$1E` | Step velocity X / Y |
| `$7F000C,X` | Anim id written by walk packets |

### Tracked IDs (see [tracked_ids.md](families/tracked_ids.md))

| Address | Role |
|---------|------|
| `$05EA` | Id staging for `code_08EF28` / `08EF7C` |
| `$0676` | Focus / selected tracked id |
| `$7E4102` | Tracked-id table A (ids ≥ `#48`) |
| `$7E4192` | Tracked-id table B (ids < `#48`) |

### Flag bitfield helpers

Handlers `JSR $&code_00DBEF` (test) and `JSR $&code_00DBBD` (set/clear) against **`$0730+`**. Full word encoding, polarity, and authoring cheat sheet: see [Event flags — Shared reference](families/event_flags.md#shared-reference).


## COP dispatch

```
code_009EE8:  ; COP entry
  REP #$20
  TXY                    ; X/Y = actor slot
  ...
  LDA [$2C]              ; read opcode
  INC $2C
  ASL : TAX
  JMP (code_list_009F10, X)
```

Helpers:

- `code_009F00` — skip 2 operand bytes and continue
- `code_009F07` — skip 4 operand bytes and continue
- Handlers end with `RTI` (continue interpreter) or `PLA PLA RTL` (yield/halt actor tick)


## Actor model (summary)

Scene logic runs as **actors**: a 5-byte header plus 65816/COP body. Common behavior classes (header field 2): `#49` NPC, `#69` object/trigger, `#68` cutscene director, `#48` prop, `#42` enemy, `#44` player host, `#60` UI. Full header distributions and `script_meta` spawn kinds remain in the [legacy monolith](../cop_actor_analysis.md#actor-types).

## Opcode roster (`$00`–`$57`)

| Op | Name | Uses | Family |
|----|------|-----:|--------|
| `00` | `gosub` | 143 | [control_flow](families/control_flow.md) |
| `01` | `return` | 114 | [control_flow](families/control_flow.md) |
| `02` | `return_main` | 14 | [control_flow](families/control_flow.md) |
| `03` | `gosub_far` | 68 | [control_flow](families/control_flow.md) |
| `04` | `return_far` | 35 | [control_flow](families/control_flow.md) |
| `05` | `repeat_begin` | 233 | [control_flow](families/control_flow.md) |
| `06` | `repeat_yield` | 219 | [control_flow](families/control_flow.md) |
| `07` | `repeat_continue` | 19 | [control_flow](families/control_flow.md) |
| `08` | `wait_flag` | 65 | [event_flags](families/event_flags.md) |
| `09` | `goto_far` | 25 | [control_flow](families/control_flow.md) |
| `0A` | `set_flag` | 1077 | [event_flags](families/event_flags.md) |
| `0B` | `branch_if_flag` | 863 | [event_flags](families/event_flags.md) |
| `0C` | `branch_if_flags` | 214 | [event_flags](families/event_flags.md) |
| `0D` | `give_reward` | 40 | [event_flags](families/event_flags.md) |
| `0E` | `branch_if_in_rect` | 47 | [proximity](families/proximity.md) |
| `0F` | `branch_if_near` | 61 | [proximity](families/proximity.md) |
| `10` | `branch_if_at_xy_facing` | 145 | [proximity](families/proximity.md) |
| `11` | `branch_if_rel_xy_facing` | 32 | [proximity](families/proximity.md) |
| `12` | `branch_if_x_facing` | 5 | [proximity](families/proximity.md) |
| `13` | `branch_if_y_facing` | 18 | [proximity](families/proximity.md) |
| `14` | `branch_if_rel_x_facing` | 0 | [proximity](families/proximity.md) |
| `15` | `branch_if_rel_y_facing` | 0 | [proximity](families/proximity.md) |
| `16` | `branch_if_actor_at_xy` | 0 | [proximity](families/proximity.md) |
| `17` | `teleport_xy_facing` | 127 | [map_placement](families/map_placement.md) |
| `18` | `request_map` | 127 | [map_placement](families/map_placement.md) |
| `19` | `queue_map_alt` | 1 | [map_placement](families/map_placement.md) |
| `1A` | `branch_if_map` | 107 | [map_placement](families/map_placement.md) |
| `1B` | `apply_flag_reset` | 4 | [event_flags](families/event_flags.md) |
| `1C` | `choice_menu` | 60 | [dialog](families/dialog.md) |
| `1D` | `show_dialog` | 1754 | [dialog](families/dialog.md) |
| `1E` | `choice_menu_no_bank` | 1 | [dialog](families/dialog.md) |
| `1F` | `show_dialog_now` | 213 | [dialog](families/dialog.md) |
| `20` | `show_dialog_bank8` | 16 | [dialog](families/dialog.md) |
| `21` | `show_dialog_far` | 5 | [dialog](families/dialog.md) |
| `22` | `set_interact` | 560 | [interact](families/interact.md) |
| `23` | `set_interact_alt` | 3 | [interact](families/interact.md) |
| `24` | `paint_tile_attrs` | 60 | [bg_tile_attrs](families/bg_tile_attrs.md) |
| `25` | `switch_param` | 14 | [switch](families/switch.md) |
| `26` | `switch_counter` | 5 | [switch](families/switch.md) |
| `27` | `queue_player_script` | 167 | [control_flow](families/control_flow.md) |
| `28` | `wander_rect` | 77 | [wander](families/wander.md) |
| `29` | `wander_rect_anim` | 8 | [wander](families/wander.md) |
| `2A` | `set_move_profile` | 14 | [wander](families/wander.md) |
| `2B` | `snap_to_player_if_flag` | 9 | [party_follow](families/party_follow.md) |
| `2C` | `claim_follower_slot` | 24 | [party_follow](families/party_follow.md) |
| `2D` | `follower_step` | 12 | [party_follow](families/party_follow.md) |
| `2E` | `follower_step_anim` | 12 | [party_follow](families/party_follow.md) |
| `2F` | `chase_step` | 2 | [chase](families/chase.md) |
| `30` | `chase_step_anim` | 1 | [chase](families/chase.md) |
| `31` | `rng_tick` | 89 | [rng](families/rng.md) |
| `32` | `set_focus_id` | 146 | [ui_focus](families/ui_focus.md) |
| `33` | `unmask_input` | 278 | [input](families/input.md) |
| `34` | `mask_input` | 337 | [input](families/input.md) |
| `35` | `bind_pad_handler` | 44 | [input](families/input.md) |
| `36` | `install_pad_profile` | 108 | [input](families/input.md) |
| `37` | `dispatch_pad` | 6 | [input](families/input.md) |
| `38` | `wait_pad` | 3 | [input](families/input.md) |
| `39` | `wait_pad_ack` | 5 | [input](families/input.md) |
| `3A` | `branch_if_pad` | 12 | [input](families/input.md) |
| `3B` | `branch_if_pad_clear` | 45 | [input](families/input.md) |
| `3C` | `play_music` | 37 | [audio](families/audio.md) |
| `3D` | `play_music_fade` | 7 | [audio](families/audio.md) |
| `3E` | `restore_music` | 31 | [audio](families/audio.md) |
| `3F` | `apu_write_0` | 0 | [audio](families/audio.md) |
| `40` | `apu_write_1` | 0 | [audio](families/audio.md) |
| `41` | `queue_sfx_3` | 277 | [audio](families/audio.md) |
| `42` | `queue_sfx_2` | 98 | [audio](families/audio.md) |
| `43` | `queue_sfx_word` | 0 | [audio](families/audio.md) |
| `44` | `solid_on` | 453 | [collision](families/collision.md) |
| `45` | `solid_off` | 213 | [collision](families/collision.md) |
| `46` | `solid_on_at` | 145 | [collision](families/collision.md) |
| `47` | `solid_off_at` | 82 | [collision](families/collision.md) |
| `48` | `sample_tile_at` | 3 | [collision](families/collision.md) |
| `49` | `probe_blocked` | 9 | [collision](families/collision.md) |
| `4A` | `branch_if_tile` | 11 | [metatiles](families/metatiles.md) |
| `4B` | `branch_if_tile_at` | 19 | [metatiles](families/metatiles.md) |
| `4C` | `set_tile` | 24 | [metatiles](families/metatiles.md) |
| `4D` | `set_tile_at` | 84 | [metatiles](families/metatiles.md) |
| `4E` | `draw_tile_at` | 6 | [metatiles](families/metatiles.md) |
| `4F` | `refresh_tile_at` | 0 | [metatiles](families/metatiles.md) |

## Example sketches

Short patterns spanning families (see family pages for full evidence):

```asm
    ; talkable NPC
    COP [44]                          ; solid_on
    COP [22] ( &on_talk )             ; set_interact
idle:
    COP [CB]
    BRA idle
on_talk:
    COP [1D] ( &string_hello )        ; show_dialog
    COP [41] ( #13 )                  ; queue_sfx_3
    COP [0A] ( #$8001 )               ; set_flag
    RTL

    ; map transition
    COP [17] ( #07, #26, #00 )        ; teleport_xy_facing
    COP [44]
    COP [18] ( #$0090, #04, #01, #16, #39 )
    COP [CB]

    ; tile trigger then rewrite
    COP [4A] ( #F9, &hit )            ; branch_if_tile
    BRA spin
hit:
    COP [4D] ( #00, #$F900 )          ; set_tile_at
```

## Related documents

| Doc | Role |
|-----|------|
| [index.md](index.md) | This overview |
| [families/](families/) | Per-family deep dives (`$00`–`$57`) |
| [../cop_actor_analysis.md](../cop_actor_analysis.md) | Actor types, full roster, `$58+` opcode notes |
| `us/copdef.json` | Operand layouts |
| `extracted/system/chunk_008000.asm` | Handlers / jump table |
| `scripts/split_cop_docs.py` | Historical splitter — **do not** rebuild family bodies from the monolith |
