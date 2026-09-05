# Robotrek COP system overview

_Canonical docs for all **251 COP opcodes** (`$00`–`$FA`). Family pages live under [`families/`](families/). All opcodes have been deep-audited._

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
| Deep-audited opcodes | `$00`–`$FA` (251 slots — **complete**) |
| Call sites (sum of per-op counts) | **23 605** |
| Family documents | **64** |

## Instruction families (`$00`–`$FA`)

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
| **Tracked IDs** | `56` `57` `58` `5A` `5B` | [tracked_ids.md](families/tracked_ids.md) | 143 |
| **Focus / Interact Binding** | `59` `7E` | [focus_interact.md](families/focus_interact.md) | 17 |
| **Currency (GP)** | `5C` `5D` `5E` | [currency.md](families/currency.md) | 18 |
| **Shop** | `5F` | [shop.md](families/shop.md) | 7 |
| **Progression (EXP / Level)** | `60` `61` | [progression.md](families/progression.md) | 35 |
| **Party Check** | `62` | [party_check.md](families/party_check.md) | 233 |
| **Interact Wait** | `63` `64` | [interact_wait.md](families/interact_wait.md) | 334 |
| **Menu / Save** | `65` `66` `67` | [menu.md](families/menu.md) | 10 |
| **Camera** | `68` `69` `6A` `6B` `6C` `6D` | [camera.md](families/camera.md) | 122 |
| **NPC Lifecycle** | `6E` `6F` `70` | [npc_lifecycle.md](families/npc_lifecycle.md) | 29 |
| **Combat / Encounter** | `71` `72` `73` | [combat.md](families/combat.md) | 88 |
| **Spawn Gate** | `74` `75` `76` | [spawn_gate.md](families/spawn_gate.md) | 385 |
| **BCD Counter** | `77` `78` | [bcd_counter.md](families/bcd_counter.md) | 19 |
| **Spawn Effect** | `79` | [spawn_effect.md](families/spawn_effect.md) | 7 |
| **Proximity 3-Way** | `7A` `7B` | [proximity_3way.md](families/proximity_3way.md) | 9 |
| **Companion Sprite** | `7C` `7D` | [companion_sprite.md](families/companion_sprite.md) | 23 |
| **Unused Ops** | `7F` | [unused_ops.md](families/unused_ops.md) | 0 |
| **Animation Setup** | `80` `81` `82` `83` `84` `85` `86` `87` `88` `89` `8A` `8B` `8C` | [anim_setup.md](families/anim_setup.md) | 2220 |
| **Child Sprite Spawn** | `8D` `8E` `8F` `90` | [child_sprite.md](families/child_sprite.md) | 60 |
| **Render Configuration** | `91` `92` `93` `94` `95` `96` `9D` `9E` `9F` `A0` `A1` | [render_config.md](families/render_config.md) | 204 |
| **Animation Wait / Tick** | `97` `98` `99` `9A` `9B` `9C` | [anim_wait.md](families/anim_wait.md) | 3141 |
| **Actor Spawn (main chain)** | `A2` `A3` `A4` `A5` `A6` `A7` `A8` | [actor_spawn.md](families/actor_spawn.md) | 27 |
| **Actor Spawn (render chain)** | `A9` `AA` `AB` `AC` `AD` `AE` `AF` `B0` `B1` | [actor_spawn_render.md](families/actor_spawn_render.md) | 819 |
| **Actor Destroy** | `B2` `B3` | [actor_destroy.md](families/actor_destroy.md) | 540 |
| **Velocity Set** | `B4` `B5` `B6` | [velocity_set.md](families/velocity_set.md) | 10 |
| **Position Adjust** | `B7` `B8` `B9` | [position_adjust.md](families/position_adjust.md) | 72 |
| **Tile Collision** | `BA` `BB` `BC` `BD` | [tile_collision.md](families/tile_collision.md) | 10 |
| **Player Move Response** | `BE` `BF` `C0` | [player_move_response.md](families/player_move_response.md) | 5 |
| **Screen Edge Branch** | `C1` `C2` `C3` `C4` | [screen_edge_branch.md](families/screen_edge_branch.md) | 12 |
| **Sprite Attribute Set** | `C5` `C6` `C7` | [sprite_attribs.md](families/sprite_attribs.md) | 111 |
| **Render Source Load** | `C8` `C9` `CA` | [render_source_load.md](families/render_source_load.md) | 148 |
| **Script Yield / Resume** | `CB` `CC` `CD` `CE` `CF` `D0` | [script_yield.md](families/script_yield.md) | 2063 |
| **Screen Effect** | `D1` `D2` `D3` `D4` | [screen_effect.md](families/screen_effect.md) | 69 |
| **Anim Source Init** | `D5` `D6` | [anim_source_init.md](families/anim_source_init.md) | 28 |
| **Player Idle / Interact** | `D7` `D8` `D9` | [player_idle.md](families/player_idle.md) | 62 |
| **Smooth Movement** | `DA` `DB` `DC` | [smooth_move.md](families/smooth_move.md) | 117 |
| **Facing Control** | `DD` `DE` `DF` `E0` `E1` `E2` | [facing_control.md](families/facing_control.md) | 168 |
| **Party AI Control** | `E3` `E4` `E5` `E6` `E7` `E8` `E9` | [party_ai.md](families/party_ai.md) | 220 |
| **Party Step** | `EA` `EB` `EC` | [party_step.md](families/party_step.md) | 199 |
| **Party Swap** | `ED` `EE` `EF` `F0` | [party_swap.md](families/party_swap.md) | 268 |
| **Party Render Init** | `F1` `F2` `F3` `F4` | [party_render.md](families/party_render.md) | 131 |
| **Party Register** | `F5` | [party_register.md](families/party_register.md) | 4 |
| **Anim Frame Remap** | `F6` | [anim_frame_remap.md](families/anim_frame_remap.md) | 4 |
| **Party State Reset** | `F7` | [party_state_reset.md](families/party_state_reset.md) | 6 |
| **Orbital Motion** | `F8` `F9` | [orbital_motion.md](families/orbital_motion.md) | 12 |
| **Child Render Tick** | `FA` | [child_render_tick.md](families/child_render_tick.md) | 25 |

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
- **Tracked IDs** (`56`, `57`, `58`, `5A`, `5B`): Claim, release, capacity-check, and branch-test globally tracked instance ids in `$7E4102` / `$7E4192` and the focus id `$0676`. `[58]` pre-checks free slot count; `[5A]` tests table A + focus; `[5B]` tests focus only (73 uses — highest in this family).
- **Focus / Interact Binding** (`59`, `7E`): Bind per-actor focus/interact descriptors (`$7F002C` / `$7F002A` / `$7F1036`) consumed by interact dispatcher `code_0BE902` and zone tick scanner `code_0BF239`. `[59]` writes the binding (12 sites); `[7E]` polls the deferred-interact latch `$7F1036` and jumps to the callback address when set (5 sites). Shares `$0676` focus id with tracked_ids but writes actor RAM, not the global tables.
- **Currency (GP)** (`5C`, `5D`, `5E`): Add, spend, and test gold points via 5-digit BCD counter at `$06E6`/`$06E8`. `[5C]` awards (saturates at 99999); `[5D]` deducts (branches on insufficient funds) with `#$FFFF` sentinel to zero GP; `[5E]` non-destructively tests affordability (subtract-then-add round-trip) and branches if affordable.
- **Shop** (`5F`): Configure shop inventory by writing 5 item IDs + mode byte into `$0B86`–`$0B92` and setting flag `#$000E`. All 7 call sites configure NPC shop inventories gated by map/flag checks.
- **Progression (EXP / Level)** (`60`, `61`): Award EXP ("Megs of data") and test player level. `[60]` adds BCD EXP, displays a message, triggers level-up if threshold crossed (unused — combat awards EXP instead). `[61]` branches when level ≥ threshold; exclusively used in 35 treasure-chest actors with level-gated rewards.
- **Party Check** (`62`): Test robot companion count by checking hardcoded IDs `#$004C`/`#$004D` in focus slots `$0676`/`$0678`. All 233 call sites require exactly 2 companions (`#$0002`), gating NPC dialog and area access.
- **Interact Wait** (`63`, `64`): Yield until the player is adjacent to and facing this actor, then turn to face the player and resume at `&Code`. `[63]` uses animation base 0; `[64]` takes a Byte operand for alternate sprite sheets. Combined 334 call sites — the primary NPC "idle → ready to talk" primitive.
- **Menu / Save** (`65`, `66`, `67`): Open full-screen menu screens and write save data. `[65]` invokes the status/diary/save menu (`code_04BF87`). `[66]` invokes the robot program/equipment config menu (`code_04C305`). Both share the same handler wrapper. `[67]` plays save SFX and block-copies game state to SRAM via `code_0AF2E4`. All used in system-level code only.
- **Camera** (`68`, `69`, `6A`, `6B`, `6C`, `6D`): Camera scroll, screen bounds, and visual effects for cinematics. `[68]` spawns a child scroll actor for camera pans (mode `#00` = init, `#01` = chain); `[69]` returns the camera to the saved position. `[6A]` configures screen scroll bounds via interpolation (shake/viewport). `[6B]` is a conditional "phase 2" scroll that waits for a flag then interpolates bounds to their final position, clearing flag `#$0322`. `[6C]` spawns a child actor for timed screen flash effects using SNES color math/windowing registers. `[6D]` applies a vertical camera jitter by adding Y offsets from a 4-entry lookup for `$30` frames — the most-used camera op (45 sites). All call sites are in cinematic contexts.
- **NPC Lifecycle** (`6E`, `6F`, `70`): Conditional spawn gating and idle-loop removal for NPCs. `[6E]` tests flag `#$000F` at init — if set, instantly destroys the actor. `[6F]` tests the same flag every idle-loop iteration — if set, redirects to `code_04BE0E` (walk-off-screen-and-destroy animation). `[6F]` also gates on `$06 bit #$4000` (interaction-busy). `[70]` is an unused simplified variant without the flag test. All 29 call sites are in NPC actors (Rococo town and map 139).
- **Combat / Encounter** (`71`, `72`, `73`): Pre-battle setup, in-battle polling, and post-battle result dispatch. `[73]` is the encounter gate — it checks a story flag to skip already-won battles, manages the battle slot table (`$7E3E20`–`$7E3ED4`, 30 slots), and dispatches to win/lose handlers. `[72]` saves the actor's script position into the slot table and yields until the battle result (`$7E3ED4,X`) is written by `actor_0BF77D`. `[71]` is a specialized NPC cleanup op that clears collision and destroys the actor when combat is active (`$06 bit #$4000`). Nearly every boss and overworld enemy actor uses `[73]` + `[72]`; `[71]` is limited to Prinky's Mansion east wing (13 sites, 2 actors).
- **Spawn Gate** (`74`, `75`, `76`): Conditional actor spawn gates that test a condition at init and destroy the actor before it appears if the condition fails. `[75]` is the single-flag gate (271 uses) — the most common spawn-time conditional, with bit 15 encoding polarity (85% use `#$8xxx` = destroy when flag IS set). `[74]` evaluates a boolean expression over multiple flags (108 uses) using AND/OR/AND-NOT operators encoded in bits 11–15 of each word. `[76]` tests the current map id (6 uses) — the actor destroys itself if on (or not on) a specific map. All three share `code_04FD4E` (self-destruct) on the destroy path. Related to `[6E] npc_spawn_gate` (hardcoded flag `#$000F`) and `[0B] branch_if_flag` (runtime branch vs. spawn-time destroy).
- **BCD Counter** (`77`, `78`): General-purpose BCD (decimal-mode) counters stored at `$7E4222`. `[78]` sets/adds/subtracts a counter value and `[77]` compares a counter against a BCD threshold and branches. Used for scene-specific tracking that isn't covered by flags: visit counts (Prinky's Mansion), donation totals (Chino building fund, target 9000 GP). Only 2 counter indices are observed (0 and 2). Counters are **not saved to SRAM** — they reset on scene change.
- **Spawn Effect** (`79`): Spawns a child particle/sprite effect at a tile position with optional movement delta. The child runs a hardcoded animation loop at `loc_04C7E5`, plays SFX, and self-destructs after a countdown. Used for cutscene effects: inventor sparks, earthquake rubble, credits animations. 7 sites across 7 files.
- **Proximity 3-Way** (`7A`, `7B`): Three-way axis proximity branches — compare player distance from the actor along X (`[7A]`) or Y (`[7B]`) against a pixel threshold and dispatch to one of three code targets: far-negative (left/above), near (within threshold), or far-positive (right/below). Uses the same player-position globals (`$0BA6`/`$0BA8`) as the `[0E]`–`[16]` proximity family. `[7A]` is used for horizontal patrol/approach (7 sites); `[7B]` only by system actor `actor_0C8000` for vertical checks (2 sites), always cascaded with `[7A]` for 2D quadrant dispatch.
- **Companion Sprite** (`7C`, `7D`): Manage the robot companion's visual appearance by switching spritemap banks on the companion actor at `$0EEE`. `[7C]` conditionally resets the companion sprite when `$0676 == #$004C` (21 sites, used as a cleanup guard after dungeons/battles). `[7D]` directly switches between two spritemap banks: `spritemap_0E8000` (normal, byte=0) and `spritemap_0EC000` (alternate/transformed, byte=1), and updates secondary focus `$0678` accordingly. Only 2 `[7D]` sites, both in `volcano_base/base_einst_house` (Dr. Einst robot transformation scene).
- **Unused Ops** (`7F`): The sole invalid slot in the 251-entry COP jump table. Entry is `#$FFFF`, which would jump to `$00:FFFF` (interrupt vector area) and crash. Not in copdef.json, 0 call sites. Every other copdef-missing opcode still has a valid handler — `[7F]` is uniquely dead. Likely an intentional reservation at the `$7E`/`$80` boundary.
- **Animation Setup** (`80`–`8C`): Thirteen opcodes that configure actor animation state. The core eight (`[80]`–`[87]`) form a combinatorial set (3-bit `speed/vel_x/vel_y`). Five extended variants: `[88]` primes step counter `$0E24`; `[89]`/`[8A]` do facing-conditional id selection via `$0A bit #$4000` (with/without speed); `[8B]` reloads spritemap via `code_08F322` and sets render flag `$08 |= #$0800`; `[8C]` sets velocity + acceleration (`$34`/`$36`) via `code_00E39E`/`code_00E3AC`. `[80]` is the **#1 most-used COP** (1247 sites). Total: 2220 call sites — the largest family by usage count.
- **Child Sprite Spawn** (`8D`–`90`): Spawn a child rendering actor for visual effects (projectiles, explosions, companion sprites). All four allocate a child slot via `code_04FDDD`, load spritemap/animation data, and render via `code_08E757` + `code_08E805`. `[8D]`/`[8E]` are guarded (check if child alive via `code_00E616`, skip if so) and continue the script; `[8F]`/`[90]` always spawn and yield. `[8E]`/`[90]` read extra tile data into `$7F0D60,X`. `[8F]` is the most common (40 sites). Parent→child link stored in `$7F0020,X`. Total: 60 call sites.
- **Animation Wait / Tick** (`97`–`9C`): Six parameterless yield/wait ops that block the script until an animation, frame count, or child sprite condition completes. Five use the shared animation frame-advance helper `code_04FC71`; `[9C]` uses the child-alive guard `code_00E616`. `[97]` (wait_anim_done, 2076 sites) is the #3 most-used COP overall. `[98]` (wait_anim_frames, 931 sites) loops `$12` times through `code_04FC71` within one handler call. `[99]` (wait_anim_clear_sprmap, 33 sites) is tightly coupled to `[8B]` — clears `$08 bit #$0800` after one frame. `[9A]` (anim_until_interact_destroy, 46 sites) loops until animation ends or `$06 bit #$4000` is set, then self-destructs via `code_04FD4E`. `[9B]` (anim_step_tick, 2 sites) is the companion to `[88]` — uses `$0E24` step counter. `[9C]` (child_wait, 53 sites) blocks until the child sprite dies. Total: 3141 call sites — the **largest family by far**.
- **Render Configuration** (`91`–`96`, `9D`–`A1`): Configure actor rendering mode and drive render ticks. Setup ops (`[91]`–`[96]`) assign spritemap banks (24-bit pointer `$7F0000,X`/`$7F0002,X`, render flag `$08 |= #$4000`) and bitmap overlays (`$7F002E,X`/`$7F0030,X` via `word_04B879` table). `[93]`/`[94]` additionally spawn a child rendering actor via `code_00E55E`. `[9D]` copies 32 bytes of OAM staging data (`$7F:0A00` → `$7E:3800`) via MVN. Wait ops tick rendering forward: `[9E]`/`[9F]` call `code_08E665` (DMA setup) + `code_08E59D` (spritemap render tick) and restore flags (`$08 &= ~#$4000`, `$06 |= #$2000`); `[A0]`/`[A1]` call `code_08E69B` (bitmap render tick). `[9F]`/`[A1]` are multi-frame variants that loop `$12` times. `[96]` and `[A1]` are unused. Total: 204 call sites.
- **Actor Spawn — main chain** (`A2`–`A8`): Seven opcodes that allocate a new actor via `code_0481EE` and link it into the main execution chain (`$0EF4` / `$24`–`$26`). All pass a far code pointer to `$28`/`$2A` as the child's script entry. `[A2]` inserts at the chain HEAD (highest priority, uses direct `$0EF4` manipulation, forces `$06 |= #$2000`). `[A3]`–`[A8]` use `code_00E535` to insert as a child of the caller. Combinatorial variants: `[A4]`/`[A6]`/`[A8]` add a flags Word → `$06`; `[A5]`/`[A6]` add facing-relative position (X negated when `$0A bit #$4000`); `[A7]`/`[A8]` add absolute X/Y position. Only `[A2]` (22), `[A3]` (2), `[A5]` (3) are used; `[A4]`/`[A6]`/`[A7]`/`[A8]` are valid handlers with 0 call sites. All initialized via `code_00E587`. Total: 27 call sites.
- **Actor Spawn — render chain** (`A9`–`B1`): Nine opcodes, the render-chain mirror of `[A2]`–`[A8]`. Allocate via `code_0481EE` and link into the execution chain at the tail end (`$0EF6` / `$24`–`$26`). `[A9]` inserts at the tail; `[AA]`–`[B1]` use `code_00E55E` to insert after the parent. Same combinatorial dimensions (position: none/facing/absolute; extra: none/flags/counter) plus an additional `$22` counter dimension (`[AB]`/`[B1]`) absent from the main-chain family. All 9 ops are used in practice. `[AD]` (facing-relative, 247 sites) and `[AA]` (basic, 206 sites) dominate — these are the primary actor spawning mechanisms in Robotrek. Total: 819 call sites — the **second-largest family** after animation wait.
- **Actor Destroy** (`B2`–`B3`): Two opcodes that remove actors from the execution chain and return slots to the free pool at `$56`. `[B2]` (`destroy_self`, 534 sites) unlinks the calling actor from the doubly-linked chain (`$24`/`$26`, endpoints `$0EF4`/`$0EF6`) via `code_04FD4E`. `[B3]` (`destroy_self_and_children`, 6 sites) first walks the `$26` chain freeing consecutive child actors (matched via `$7F0022,X`), then unlinks and frees itself via `code_04FD85`. `[B2]` is the standard actor termination — the third-most-used COP opcode overall. Total: 540 call sites.
- **Velocity Set** (`B4`–`B6`): Three opcodes that set actor velocity fields (`$1C` / `$1E`) via lookup in velocity table `unk29_list_01C3B9`. `[B4]` (10 sites) sets X velocity from a Byte index; `[B5]` (0 sites) sets Y velocity; `[B6]` (0 sites) sets both. Same table as [Animation Setup](families/anim_setup.md) but changes velocity independently without resetting animation state. `[B5]` and `[B6]` are not in copdef.json. Total: 10 call sites.
- **Position Adjust** (`B7`–`B9`): Three opcodes that adjust the actor's world position (`$00`/`$02`) by a signed offset. `[B7]` (24 sites) adjusts X with facing-relative negation (`$0A bit #$4000`); `[B8]` (27 sites) adjusts Y directly; `[B9]` (21 sites) adjusts both. The facing-relative X mechanism is identical to spawn offset ops (`[A5]`/`[AD]`). These move the actor instantly (position delta) rather than through velocity. Balanced usage across all three variants. Total: 72 call sites.
- **Tile Collision** (`BA`–`BD`): Four directional tile collision checks. Each computes a probe point (`$34 = $00 − 8`, `$36 = $02 − 16`), converts to a tile map index via `code_0AF4B6`, and reads the tile attribute from `$7FA000`. Returns tile type in `$30` (0 = passable, `#$0F` = solid, other = special). `[BA]` = right (`code_00DF84`), `[BB]` = left (`code_00E045`), `[BC]` = up (`code_00DDF4`), `[BD]` = down (`code_00DEB5`). Multi-tile actors scan across their bounding box using `$7F0012,X` (width) / `$7F0014,X` (height). Primary consumers: player host and NPC patrol actors. Total: 10 call sites.
- **Player Move Response** (`BE`–`C0`): Three player-host-exclusive opcodes for collision response. `[BE]` (horizontal, 2 sites) and `[BF]` (vertical, 2 sites) read `$30` from a prior `[BA]`–`[BD]` check: if `#$0F` (solid), branch to fallback; otherwise set walking animation (`$0BAE` = 9 or 11), update direction state via `code_00E4E1`, and compute cross-axis velocity via `code_00E3BA`. Special tile type `#$02` (stairs) applies diagonal velocity overrides from `$09F8`–`$0A00`. `[C0]` (idle, 1 site) sets idle animation via `code_00E420` and clears both velocities. Total: 5 call sites.
- **Screen Edge Branch** (`C1`–`C4`): Four screen boundary proximity checks. Each reads a margin byte, computes actor position ± margin ± body-center offset (−8 X, −16 Y), and compares to the screen edge: `$0860` (left), `$0862` (top), `$0864` (right), `$0866` (bottom). Branches to &Code target when near the edge; otherwise skips via `code_009F00`. Player-host exclusive, used in three parallel movement-mode blocks that each test all four edges. Total: 12 call sites.
- **Sprite Attribute Set** (`C5`–`C7`): Three opcodes that write SNES OAM sprite attribute fields into the actor's `$0A` word (high byte = `vhoopppc`). Each clears a specific bit-field with an AND mask, then OR's in the byte operand (XBA'd to high byte). `[C5]` (54 sites) writes priority (bits 12–13, `AND #$CFFF`); `[C6]` (33 sites) writes palette (bits 9–11, `AND #$F1FF`); `[C7]` (24 sites) writes name table page (bit 8, `AND #$FEFF`). Operands are pre-positioned in OAM bit layout (e.g., `#$30` = priority 3, `#$0E` = palette 7). C5–C7 never touch the h-flip bit (14, facing flag). Total: 111 call sites.
- **Render Source Load** (`C8`–`CA`): Three opcodes that load graphics source data pointers. `[C8]` (73 sites) loads a 24-bit spritemap table pointer (`$7F0000,X`/`$7F0002,X`) with optional animation reset via `code_04FC71`/`code_04FCE6`. `[C9]` (24 sites) loads a 24-bit bitmap pointer (`$7F002E,X`/`$7F0030,X`) and sets `$08 |= #$8000` (bitmap mode); 23/24 uses point to `$7FD000` (WRAM buffer). `[CA]` (51 sites) is a high-level portrait loader: computes a bitmap pointer from a 1-based ID into `rawbitmap_158000` (2048 bytes each), DMAs palette from `palettes_026BE8` (32 bytes each) to `$7E:38E0`, caches the ID in `$09BE`, and yields via RTL. Complements [Render Configuration](families/render_config.md) — that family uses table lookups and child actors; this one writes pointers directly. Total: 148 call sites.
- **Script Yield / Resume** (`CB`–`D0`): Six opcodes that control actor script scheduling. All write to `$28`/`$2A` (saved resume pointer) and optionally yield via RTL. Two axes: resume source (current PC vs explicit @Code) and yield (yes/no), with an optional delay axis. `[CB]` (744 sites, `mark_resume`) saves current PC + continues; `[CC]` (393 sites, `yield`) saves current PC + yields; `[CD]` (6 sites, `yield_to_delay`) sets @Code + Word delay + yields; `[CE]` (7 sites, `yield_to`) sets @Code + yields; `[CF]` (151 sites, `set_resume`) sets @Code + continues; `[D0]` (762 sites, `delay_frames`) reads Word → `$0E` + saves current PC + yields. D0 is the most-used op in the family and the standard "sleep N frames" instruction. The **largest family** by call sites. Total: 2063 call sites.
- **Screen Effect** (`D1`–`D4`): Four opcodes that start and wait for global screen effects (fades, shakes, scrolls, transitions) via `$0BC0`–`$0BC8`. `[D1]` (34 sites, `start_screen_effect`) takes 3 bytes: type + 2 params, sets `$0BC0` with `#$8000` active flag. `[D2]` (12 sites, `start_screen_effect_vx`) adds X scroll velocity via `code_00E398` → `$0BC6`. `[D3]` (21 sites, `start_screen_effect_vy`) adds Y scroll velocity → `$0BC8`. All three busy-wait if an effect is active. `[D4]` (2 sites, `wait_screen_effect`) busy-waits until `$0BC0` clears. Primarily used for earthquake/rumble effects in cutscenes. Total: 69 call sites.
- **Anim Source Init** (`D5`–`D6`): Two convenience opcodes that combine animation ID + spritemap pointer load + name table clear + resume save in one instruction. `[D5]` (26 sites, `init_anim_spritemap`) takes Byte (anim ID) + Address (spritemap ptr). `[D6]` (2 sites, `init_anim_spritemap_spd`) adds a speed byte → `$12`. Both set `$7F000C,X`, clear `$10`, load `$7F0000,X`/`$7F0002,X`, clear `$0A` bit 8, and save `$28`. Unlike `[C8]`, they do NOT call `code_04FC71` (no frame advance). Total: 28 call sites.
- **Player Idle / Interact** (`D7`–`D9`): Three system-only opcodes implementing the player host's idle/interact loop. All share `code_03CD92` (interact check) and `code_00CDFB` (player state update). `[D7]` (1 site, `player_idle_facing`) uses `$05CC` + facing-dependent animation (2/3). `[D8]` (58 sites, `player_idle`) uses `$05CE` + animation base from `$7F002C,X`. `[D9]` (3 sites, `player_idle_base`) sets `$7F002C,X` from Byte operand, then enters D8's body. When interaction triggers, skips 4 bytes into inline handler code. Total: 62 call sites.
- **Smooth Movement** (`DA`–`DC`): Three opcodes for smooth interpolated actor movement. `[DA]` (33 sites, `calc_target_pos`) computes a target position from a party member index (`$7F0008,X` → `$0A02,Y`) with signed Y offset; mode byte controls slot source and teleport. `[DB]` (42 sites, `setup_smooth_move`) configures linear interpolation from actor position to `$34`/`$36`: computes delta X/Y, direction flags, and step size via SNES hardware divide. Word: low = step count, high = frame limit (`$FF` = unlimited). `[DC]` (42 sites, `exec_smooth_move`) executes one step per tick using hardware multiply/divide for sub-pixel interpolation (`code_00D155`), advances animation frames, yields per step. System-focused. Total: 117 call sites.
- **Facing Control** (`DD`–`E2`): Six opcodes that modify actor facing/flip in `$0A` and advance one animation frame via `code_04FC71`. `[DD]` (24 sites, `toggle_facing`) toggles h-flip. `[DE]` (0 sites, `toggle_vflip`, not in copdef) toggles v-flip. `[DF]` (21 sites, `face_right`) clears h-flip. `[E0]` (20 sites, `face_left`) sets h-flip. `[E1]` (103 sites, `face_toward`) looks up a target party member via `$7F0008,X` → `$0A02,Y` and sets facing toward it. `[E2]` (0 sites, `proximity_branch_toward`, not in copdef) is an unused proximity-based 3-way branch toward a target. System-only. Total: 168 call sites.
- **Party AI Control** (`E3`–`E9`): Seven system-only opcodes for the party member AI controller. Five are conditional branches, one sets state + yields, and one is unused. `[E3]` (57 sites, `branch_party_slot`) does a 3-way branch by searching primary entity slots (`$0A02[0..4]` via `code_00D31C`) for a matching party member. `[E4]`/`[E5]` (17 sites each, `branch_no_prev/next_partner`) branch if the previous/next party member is absent from the secondary entity group (`$0A02[6..10]` via `code_00D37F`). `[E6]` (20 sites, `branch_if_state`) branches if actor `$7F0006,X` equals a Byte operand — state machine dispatch. `[E7]` (19 sites, `set_state_yield`) writes Byte to `$7F100C,X`, sets &Code as resume point, and yields with a 2-frame delay — behavior state transition. `[E8]` (90 sites, `branch_party_near`) branches if a target party member is within a facing-adjusted distance threshold (Word pixels). `[E9]` (0 sites, `branch_party_near_behind`, not in copdef) is an unused reverse-facing variant of E8 that measures distance from the actor's back. All 220 sites are in system chunks. Total: 220 call sites.
- **Party Step** (`EA`–`EC`): Three system-only opcodes implementing tile-aware directional movement for party members. `[EA]` (17 sites, `tile_scan_classify`) probes tiles in a facing-dependent direction and classifies terrain into `$30` (0=occupied, 1=solid, 2–4=special); all sites use Byte=0 (perpendicular scan). Uses tile helpers `code_00DEB5` (down), `code_00DDF4` (up), `code_00DD06` (right), `code_00DC26` (left). `[EB]` (91 sites, `party_step_start`) initiates a directional step: Byte low 7 bits = step count stored in `$7F0028,X`, bit 7 = facing inversion; checks tile passability, sets velocity via `code_00E462`, updates direction via `code_00E4E1`. `[EC]` (91 sites, `party_step_tick`) decrements `$7F0028,X` each frame (preserving bit 7 via ASL/DEC/DEC/ROR), yields with saved resume from `$7F002A,X`. EB↔EC form a multi-frame movement loop wrapping `[51]`/`[52]` step brackets. Total: 199 call sites.
- **Party Swap** (`ED`–`F0`): Four system-only opcodes implementing a two-phase position swap between adjacent party members. Phase 1: `[ED]` (67 sites, `swap_prev_start`) / `[EE]` (67 sites, `swap_next_start`) snapshot positions via `code_04FE07`, stage data in `$0AF6,Y`, save &Code to `$7F2004,X`, and yield. Phase 2: `[EF]` (67 sites, `swap_prev_exec`) / `[F0]` (67 sites, `swap_next_exec`) execute the swap — check `$0AF6` busy guard, set `$0EE2` DMA flags, reassign entity slots in `$0A02`, and move entities to cached or computed positions. EF/F0 validate tile passability (`code_00E1AD`, `code_00E45F`) for empty-slot targets and apply 8-frame delay for primary characters. On slot boundary (0 or 4), jump to completion handler `$7F2004,X`. Perfect symmetry: all four ops have exactly 67 sites. Total: 268 call sites.
- **Party Render Init** (`F1`–`F4`): Four system-only opcodes configuring rendering for party member child actors. `[F1]` (15 sites, `branch_party_type`) 3-way branches by party member type from `$06C5` table (type < 4, 4–6, ≥ 7). `[F2]` (8 sites, `init_party_render_facing`) sets facing-dependent animation base (±1 for h-flip), velocity via `code_00E398`, and optional render flag clear; loads spritemap from `$05F8` via parent. `[F3]` (27 sites, `init_party_render_sfx`) explicit spritemap bank + animation ID + velocity + optional SFX (`$0879`). `[F4]` (81 sites, `init_party_render`) generic: Word flags → `$06`, Word render flags → `$08`, Byte spritemap bank via parent. All F2–F4 share `code_08F3EA` (spritemap load) + `code_08F34B` (render init) through parent's `$7F0022,X`. F4 dominates with 62% of sites. Total: 131 call sites.
- **Party Register** (`F5`): A single system-only opcode that registers an actor as a secondary party member. `[F5]` (4 sites, `register_party_member`) claims a capability slot in `$05C8` (bits 8/9/10), matches actor Y position to battle row ($50/$70/$90), registers in `$0A08,Y`, and inherits state from parent (`$7F0006`, `$7F101A`, `$7F101C`). On failure: &Code fallback or self-destruct via `code_04FD4E`. Total: 4 call sites.
- **Anim Frame Remap** (`F6`): A single system-only opcode. `[F6]` (4 sites, `init_anim_with_remap`) sets animation ID (Byte low 7 bits → `$7F000C,X`), advances one frame via `code_04FC71`. If Byte bit 7 is set, first calls `code_00D9FC` to copy the parent's spritemap data to WRAM with palette bits remapped from actor `$02` — creating palette-swapped sprite variants for party members. Total: 4 call sites.
- **Party State Reset** (`F7`): A single system-only opcode. `[F7]` (6 sites, `reset_party_state`) bulk-clears 13 actor RAM fields: `$0E` (delay), `$1C`/`$1E` (velocity), `$7F1026`/`$7F1028` (follower), `$7F0020` (multipurpose), and 7 `$7F2xxx` state fields. Used at party member behavior phase boundaries as a clean-slate reset before entering a new behavior mode. Total: 6 call sites.
- **Orbital Motion** (`F8`–`F9`): Two system-only opcodes for accumulator-based curved/orbital position interpolation. `[F8]` (4 sites, `set_orbit_accum`) initializes two 16-bit accumulators (`$7F0032,X`/`$7F0034,X`). `[F9]` (8 sites, `orbit_step`) decrements `$30` (step counter), adds Word deltas byte-wise to accumulators, converts to world X/Y via sine/cosine lookup tables (`byte_01CA81`/`byte_01CAC1`) through `code_03CE6D`, writes position to target entity (`$7F0036,X`), and yields. F9 saves its own address as resume to re-execute each frame. Total: 12 call sites.
- **Child Render Tick** (`FA`): A single system-only opcode for child rendering actor tick. `[FA]` (25 sites, `child_render_yield`) checks parent actor's `$0006 bit #$0080` — if set, destroys self+children via `code_04FD85`. Otherwise reads Byte (frame limit); if `$32 > Byte`, reduces delay by 8 (frame acceleration). Sets delay `$0E` and yields. Used in a table-driven 25-frame animation sequence with descending frame limits (#18 → #00). Total: 25 call sites.

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
| `[58]` ↔ `[59]` | table capacity check vs **per-actor focus binding** |
| `[5B]` ↔ `[5C]` | focus id branch vs **GP add** (completely unrelated) |
| `[5E]` ↔ `[5F]` | GP affordability test vs **shop inventory** config |
| `[5F]` ↔ `[60]` | shop slots vs **EXP award** |
| `[61]` ↔ `[62]` | level branch vs **companion count** (both branch but different state) |
| `[62]` ↔ `[63]` | companion count vs **adjacency yield** |
| `[64]` ↔ `[65]` | adjacency yield (anim) vs **menu open** |
| `[65]` ↔ `[66]` ↔ `[67]` | same menu family: status, robot config, save |
| `[67]` ↔ `[68]` | save game vs **camera scroll** |
| `[6A]` ↔ `[6B]` | screen_shake (sets `#$8322`) vs camera_scroll_await (clears `#$0322`) — same family but distinct phases |
| `[6B]` ↔ `[6C]` | scroll-bound interpolation vs **screen flash child** (different mechanisms) |
| `[6D]` ↔ `[6E]` | camera Y jitter vs **NPC spawn gate** (completely unrelated) |
| `[70]` ↔ `[71]` | NPC busy-wait (lifecycle) vs **combat solid gate** (battle system) |
| `[73]` ↔ `[74]` | encounter gate (combat) vs **flag expression spawn gate** (different families; both can destroy actor but for unrelated reasons) |
| `[78]` ↔ `[79]` | BCD counter set/add vs **spawn effect** (sequential opcodes but completely unrelated systems) |
| `[79]` ↔ `[7A]` | spawn effect vs **proximity 3-way branch** (unrelated; `[7A]`/`[7B]` are sibling to `[0E]`–`[16]` proximity, not to `[79]`) |
| `[7B]` ↔ `[7C]` | vertical proximity branch vs **companion sprite reset** (different families despite adjacency) |
| `[7D]` ↔ `[7E]` | companion sprite set vs **deferred interact resume** (`[7E]` belongs to focus_interact family with `[59]`, not companion_sprite) |
| `[7E]` ↔ `[7F]` | deferred interact resume vs **unused crash** (live opcode vs dead slot) |
| `[7F]` ↔ `[80]` | unused crash vs **animation setup** (dead slot boundary before the animation family) |
| `[87]` ↔ `[88]` | Same family but different mechanism: `[80]`–`[87]` are the combinatorial core; `[88]` adds step counter `$0E24` side-effect |
| `[89]` ↔ `[8A]` | Same family — `[8A]` falls through to `[89]`'s handler, adding a speed byte |
| `[8C]` ↔ `[8D]` | animation setup (accel) vs **child sprite spawn** (different system — anim config vs child actor allocation) |
| `[90]` ↔ `[91]` | child sprite spawn (allocates via `code_04FDDD`) vs **render config** (sets spritemap bank pointer + render mode flags — different mechanism) |
| `[96]` ↔ `[97]` | bitmap overlay setup (render_config) vs **animation wait** (different system — setup vs wait/tick) |
| `[9C]` ↔ `[9D]` | child_wait (anim_wait family) vs **OAM copy** (render_config family — different system; `[9C]` checks child alive, `[9D]` does MVN block copy) |
| `[A1]` ↔ `[A2]` | bitmap render wait (render_config) vs **actor spawn main chain** (different system — rendering vs actor allocation) |
| `[A8]` ↔ `[A9]` | actor spawn main chain (`$0EF4` via `code_00E535`) vs **actor spawn render chain** (`$0EF6` — different chain, different helper, different purpose) |
| `[B1]` ↔ `[B2]` | render chain spawn (facing+counter via `code_00E55E`) vs **actor destroy** (`code_04FD4E`) — opposite operations (create vs destroy) |
| `[B3]` ↔ `[B4]` | actor destroy (children+self via `code_04FD85`) vs **velocity set** (table lookup → `$1C`) — unrelated operations |
| `[B6]` ↔ `[B7]` | velocity set (table lookup → `$1C`+`$1E`) vs **position adjust** (facing-relative `$00` offset) — both affect movement but different targets and mechanisms |
| `[B9]` ↔ `[BA]` | position adjust (instant `$00`+`$02` delta) vs **tile collision** (read-only tile map query returning `$30`) — position mutation vs read-only collision test |
| `[BD]` ↔ `[BE]` | tile collision (read-only `$30` probe) vs **player move response** (animation + velocity setup based on `$30`) — tightly coupled but different roles: query vs act |
| `[C0]` ↔ `[C1]` | player move response idle (animation/velocity setup) vs **screen edge branch** (position boundary conditional branch) — movement state vs spatial condition |
| `[C4]` ↔ `[C5]` | screen edge branch (position vs `$0864` boundary) vs **sprite attribute set** (writes OAM priority/palette/nametable bits in `$0A`) — spatial condition vs sprite rendering config |
| `[C7]` ↔ `[C8]` | sprite attribute set (single OAM bit in `$0A`) vs **render source load** (3-byte spritemap pointer `$7F0000,X` + animation init) — `$0A` field write vs graphics source setup |
| `[CA]` ↔ `[CB]` | render source load (portrait bitmap + palette DMA + yield) vs **script yield/resume** (pure scheduling: save PC, yield) — graphics data load vs execution control |
| `[D0]` ↔ `[D1]` | script yield/resume (`delay_frames` — read Word delay, save current PC, yield) vs screen effect (`start_screen_effect` — write `$0BC0`–`$0BC8`, busy-wait if active). D0 operates on `$28`/`$0E`; D1 on global screen effect registers |
| `[D4]` ↔ `[D5]` | screen effect (`wait_screen_effect` — busy-wait until `$0BC0` clears) vs anim source init (`init_anim_spritemap` — set animation ID + spritemap pointer + name table). Different subsystems |
| `[D6]` ↔ `[D7]` | anim source init (`init_anim_spritemap_spd` — combined render setup) vs player idle (`player_idle_facing` — idle loop + interact check via `$05CC`/`code_03CD92`). Different subsystems entirely |
| `[D9]` ↔ `[DA]` | player idle (`player_idle_base` — sets anim base + idle loop) vs smooth movement (`calc_target_pos` — computes party member position). D9 uses `$05CE`/`code_03CD92`; DA uses `$0A02,Y`/`$0B12` |
| `[DC]` ↔ `[DD]` | smooth movement executor (`exec_smooth_move` — tick-by-tick interpolation + animation) vs facing control (`toggle_facing` — EOR `$0A` bit 14). DC moves the actor; DD changes its visual facing |
| `[E2]` ↔ `[E3]` | facing control (`proximity_branch_toward` — unused distance-based 3-way branch modifying `$0A` facing) vs party AI control (`branch_party_slot` — 3-way branch searching primary entity slots `$0A02[0..4]`). Both use party member lookup but E2 modifies facing state while E3 is a pure dispatch branch |
| `[E9]` ↔ `[EA]` | party AI control (`branch_party_near_behind` — unused reverse-facing proximity, decision-making) vs party step (`tile_scan_classify` — tile collision scanning for movement execution). E9 decides IF to move; EA determines WHERE to move |
| `[EC]` ↔ `[ED]` | party step (`party_step_tick` — movement countdown, manipulates `$7F0028,X` direction counter) vs party swap (`swap_prev_start` — entity slot swapping, manipulates `$0AF6,Y` staging area). Movement vs. reordering |
| `[F0]` ↔ `[F1]` | party swap execution (`swap_next_exec` — entity slot movement) vs party render init (`branch_party_type` — rendering type dispatch) |
| `[F4]` ↔ `[F5]` | party render init (`init_party_render` — spritemap/flags setup) vs party register (`register_party_member` — entity slot registration) |
| `[F5]` ↔ `[F6]` | party register (entity slot claim) vs anim frame remap (animation + spritemap palette copy) |
| `[F6]` ↔ `[F7]` | anim frame remap (single-frame animation init) vs party state reset (bulk field clear) |
| `[F7]` ↔ `[F8]` | party state reset (zeroing fields) vs orbital motion (accumulator init for curved movement) |
| `[F9]` ↔ `[FA]` | orbital motion step (accumulator tick + trig conversion) vs child render tick (parent-guarded yield + frame acceleration) |

## Top opcodes by usage (`$00`–`$FA`)

| Rank | Op | Name | Uses | Family |
|-----:|----|------|-----:|--------|
| 1 | `97` | `wait_anim_done` | 2076 | [anim_wait](families/anim_wait.md) |
| 2 | `1D` | `show_dialog` | 1754 | [dialog](families/dialog.md) |
| 3 | `80` | `set_anim` | 1247 | [anim_setup](families/anim_setup.md) |
| 4 | `0A` | `set_flag` | 1077 | [event_flags](families/event_flags.md) |
| 5 | `98` | `wait_anim_frames` | 931 | [anim_wait](families/anim_wait.md) |
| 6 | `0B` | `branch_if_flag` | 863 | [event_flags](families/event_flags.md) |
| 7 | `D0` | `delay_frames` | 762 | [script_yield](families/script_yield.md) |
| 8 | `CB` | `mark_resume` | 744 | [script_yield](families/script_yield.md) |
| 9 | `51` | `step_begin` | 662 | [movement](families/movement.md) |
| 10 | `52` | `step_end` | 662 | [movement](families/movement.md) |
| 11 | `22` | `set_interact` | 560 | [interact](families/interact.md) |
| 12 | `B2` | `destroy_self` | 534 | [actor_destroy](families/actor_destroy.md) |
| 13 | `44` | `solid_on` | 453 | [collision](families/collision.md) |
| 14 | `CC` | `yield` | 393 | [script_yield](families/script_yield.md) |
| 15 | `84` | `set_anim_spd` | 354 | [anim_setup](families/anim_setup.md) |
| 16 | `34` | `mask_input` | 337 | [input](families/input.md) |
| 17 | `63` | `wait_facing` | 311 | [interact_wait](families/interact_wait.md) |
| 18 | `54` | `walk_to_y` | 281 | [movement](families/movement.md) |
| 19 | `33` | `unmask_input` | 278 | [input](families/input.md) |
| 20 | `41` | `queue_sfx_3` | 277 | [audio](families/audio.md) |
| 21 | `75` | `gate_flag` | 271 | [spawn_gate](families/spawn_gate.md) |
| 22 | `AD` | `spawn_render_child_offset` | 247 | [actor_spawn_render](families/actor_spawn_render.md) |
| 22 | `62` | `branch_if_companions` | 233 | [party_check](families/party_check.md) |
| 23 | `05` | `repeat_begin` | 233 | [control_flow](families/control_flow.md) |
| 24 | `86` | `set_anim_spd_vy` | 220 | [anim_setup](families/anim_setup.md) |
| 25 | `06` | `repeat_yield` | 219 | [control_flow](families/control_flow.md) |


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
| `60` | `award_exp` | uses=0; params=Word (not in copdef); handler fully traced |
| `70` | `npc_busy_wait` | uses=0; params=Byte (not in copdef); simplified `[6F]` variant |
| `7F` | `unused_crash` | uses=0; jump table entry `#$FFFF` → crashes if reached |
| `96` | `set_bitmap_overlay_spd` | uses=0; speed variant of `[95]`; not in copdef |
| `A1` | `bitmap_render_wait_multi` | uses=0; multi-frame bitmap wait; not in copdef |
| `A4` | `spawn_actor_child_flags` | uses=0; child spawn + flags word; not in copdef |
| `A6` | `spawn_actor_child_offset_flags` | uses=0; child spawn + facing offset + flags; not in copdef |
| `A7` | `spawn_actor_child_xy` | uses=0; child spawn + absolute X/Y; not in copdef |
| `A8` | `spawn_actor_child_xy_flags` | uses=0; child spawn + absolute X/Y + flags; not in copdef |
| `B5` | `set_velocity_y` | uses=0; Y velocity via table lookup; not in copdef |
| `B6` | `set_velocity_xy` | uses=0; both X+Y velocity via table lookup; not in copdef |
| `DE` | `toggle_vflip` | uses=0; toggles v-flip in `$0A`; not in copdef |
| `E2` | `proximity_branch_toward` | uses=0; proximity-based 3-way branch; not in copdef |
| `E9` | `branch_party_near_behind` | uses=0; reverse-facing proximity check; not in copdef |

## Memory map (script / actor relevant)

Addresses below are those most frequently touched by COP handlers and actor scripts. Direct page / absolute WRAM unless noted.

### Script engine (per running actor)

| Address | Role (inferred) | Evidence |
|---------|-----------------|----------|
| `$2C` / `$2E` | Script read pointer (24-bit via `[ $2C ]`) | COP dispatcher `code_009EE8` loads opcode from `[$2C]`, handlers `INC $2C` |
| `$28` / `$2A` | **Saved resume pointer** (address / bank). Scheduler jumps here when `$0E == 0`. | `[CB]`/`[CC]` save current PC; `[CD]`/`[CE]`/`[CF]` save @Code operand; `[CA]` saves on portrait load; many wait handlers also save |
| `$2A` | Script bank byte (far calls/gotos) | `gosub_far` / `goto_far` (`COP [03]` / `[09]`) |
| `$30`, `$32` | Script temps — `[0C]` flag accum; **`[48]`/`[49]` leave tile/blocked result in `$30`** | Also used by solid helpers as scratch |
| Stack `$02,S` / `$04,S` | Return PC / bank patched by COP | `STA $02,S` pattern in call/jump ops |

### Per-actor RAM (`$7Fxxxx,X` — X = actor index/slot)

| Offset | Role (inferred) | Used by |
|--------|-----------------|---------|
| `$7F001A,X` | **Single-level near gosub return** (also reused by `[27]` / `[37]`) | `COP [00]`/`[01]` primarily |
| `$7F001C,X` / `$7F001E,X` | **Far gosub return PC / bank** | `COP [03]`/`[04]` |
| `$7F000C,X` | Current animation id | `COP [80]`–`[8C]` (anim_setup), `[91]`–`[96]` (render_config), `[D5]`/`[D6]` (anim_source_init), `[D7]`/`[D8]` (player_idle), `[DB]` (smooth_move) |
| `$7F0012,X` / `$7F0014,X` | Footprint W/H (tiles) for solid ops; also step/walk temps | `[44]`–`[49]` if `W+H≥3`; `[51]`/`[52]`; `[BA]`–`[BD]` multi-tile path |
| `$7F000E,X` / `$7F0010,X` | Footprint origin offsets (multi-tile solid paint/probe) | `[44]`–`[49]` large path; `[BA]`–`[BD]` multi-tile path |
| `$7F0020,X` (= DP `$20`) | **Multipurpose actor word** — chase-slot index for `[2F]`/`[30]`; also general counter (credits wait/`INC $20`) | Scripts + chase claim |
| `$7F0022,X` | Parent actor link for spawned children | `[A2]`–`[A8]` main chain + `[A9]`–`[B1]` render chain |
| `$7F0024,X` | **Main/idle resume PC** *or* **repeat loop head** (shared!) | `COP [02]` returns here; `[05]` writes head; `[06]`/`[07]` rewind |
| `$7F0026,X` | Repeat remaining count | `COP [05]`/`[06]`/`[07]` |
| `$7F0028,X` | **Primary interact / talk script** (`&Code`) | `COP [22]`; dispatched by `code_0BE478` |
| `$7F2032,X` | **Alternate interact script** (companion `$004C` mode) | `COP [23]`; fallback in `code_0BE478` |
| `$7F101A,X` | **Move / step profile** (velocity-table band select) | `COP [2A]`; consumed by `code_00E3BA` / `code_00E420` |
| `$7F101C,X` | Movement table base (copied from player on `[2C]` join) | Wander / follow step helpers |
| `$7F1028,X` | **Follower slot index** (×2 into `$09CA`/`$09D6`) | `COP [2C]` claim; `[2D]` follow |
| `$7F0000,X` / `$7F0002,X` | **Spritemap bank pointer** (24-bit: lo word / bank byte) — render_config `[91]`–`[94]` set to spritemap address; `[95]`/`[96]` set to `#$4800`/`#$007E` (VRAM dest); `[C8]` loads directly from far pointer operand; `[D5]`/`[D6]` load as part of combined anim+spritemap init |
| `$7F002E,X` / `$7F0030,X` | **Bitmap overlay pointer** (24-bit) — `[95]`/`[96]` set via `word_04B879` lookup; `[C9]` sets directly; `[CA]` computes from portrait ID into `rawbitmap_158000` |
| `$7F0006,X` | **Entity state / sprite ID** — party member formation state. `[E6]` compares against Byte; `[F5]` copies from parent (or sets directly) during registration |
| `$7F0032,X`–`$7F0035,X` | **Orbital motion accumulators** — 4-byte angle/radius state for sine/cosine position interpolation | `[F8]` initializes; `[F9]` adds deltas per frame |
| `$7F0036,X` | **Orbital target entity pointer** — entity whose position is updated by `code_03CE6D` | Scripts set from `$7F0022,X` before `[F8]`/`[F9]` |
| `$7F0DF0,X` / `$7F0E08,X` | Spritemap table pointer (lo/bank) — used by child sprite spawn `[8D]`–`[90]` and player controller `actor_04B763` |

#### `$7F` offsets referenced by COP handlers (by # of opcodes)

| Address | #opcodes |
|---------|----------|
| `$7F000C` | 37 |
| `$7F0022` | 23 |
| `$7F0008` | 13 |
| `$7F0000` | 14 |
| `$7F0002` | 14 |
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
| `$7F002E` | 5 |
| `$7F0030` | 5 |
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
| `$0A` | Actor flags — low byte: logic flags; high byte: SNES OAM attribs (`vhoopppc`). Bit `#$4000` = h-flip/facing (used by `[89]`, spawn offsets). Bits 12–13 = priority (`[C5]`), bits 9–11 = palette (`[C6]`), bit 8 = name table (`[C7]`) |
| `$0E` | **Delay counter** — decremented each tick; actor skipped while nonzero. Set by `[D0]`/`[CD]`; cleared by `[CE]`/`[CF]`; unchanged by `[CB]`/`[CC]` |
| `$10` / `$12` | Anim progress / frame counter |
| `$1C` / `$1E` | Anim velocity / delta X/Y |
| `$0BA6` / `$0BA8` | **Player cell X / Y** (`player.$00−8`, `player.$02−16`) | `[0E]`–`[15]` proximity family |
| `$0BB2` / `$0BB4` | Player cell X/Y `>>4` (coarse) | Set alongside `$0BA6`/`$0BA8` in `code_00FA5E` |
| `$0BAA` | **Player facing** (copy of player `$0C`) | Facing filter on `[0E]`/`[0F]`/`[10]`/… |
| `$0E24` | **Animation step counter** — set by `COP [88]`, decremented by `COP [9B]`; also used as frame counter by engine (`chunk_048000.asm`) |
| `$05A8` | **Current map / scene id** (`COP [1A]` / `branch_if_map`) | Loaded from pending `$05A6` |
| `$0553` | Sticky latch cleared by `COP [1B]` (and a few system paths) | No reads found in extract |
| `$05A6` | **Pending map id** for next load (`COP [18]`); cleared when consumed | → `$05A8` / `$05AA` on transition |
| `$05AC` / `$05B6` | Entrance / transition mode + param | `[18]`; `$05AC` dispatches `code_0097F8` |
| `$05BA` / `$05BE` | Primary camera / spawn cell X/Y | `[18]`; used by follow logic `code_00F9BD` |
| `$05BC` / `$05C0` | Alternate camera target X/Y (non-zero → prefer over BA/BE) | Cleared by `[18]`; set via `[19]` apply path |
| `$05E8`, `$05E0`–`$05E6` | **Deferred / alt** map-request block (`COP [19]`) | Promoted later (`code_008869` / combat return) |
| `$0EEE` | **Player actor slot** (index into actor pool) | `[27]` targets this; set by player host |
| `$0EE2` | **DMA slot bitmask** — `code_08E665` sets bit `#$0002` to prevent duplicate DMA queuing; used by `[9E]`/`[9F]` |
| `$0EF4` | **Execution chain head** — element with `$24 == 0`; `[A2]` inserts at this end; `code_00E535` (`[A3]`–`[A8]`) inserts before parent toward head; `code_04FD4E`/`code_04FD85` update on destroy |
| `$0EF6` | **Execution chain tail** — element with `$26 == 0`; `[A9]` inserts at this end; `code_00E55E` (`[AA]`–`[B1]`, `[93]`/`[94]`) inserts after parent toward tail; `code_04FD4E`/`code_04FD85` update on destroy |
| `$56` | **Actor free pool stack pointer** — grows downward; `code_0481EE` pops (reads `($56)`, `$56 += 2`); `code_04FD4E`/`code_04FD85` push (`$56 -= 2`, writes slot) |
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
| `$7FA000` | **Collision / occupancy map** — lo nibble = terrain type; hi `#$F0` = actor solid | `[44]`–`[49]`; `[BA]`–`[BD]` read; also set from tile-id table by `code_0AF5A4` |
| `$095E` | **BG / tile-update queue cursor** (bytes); `≥$80` → tile-write COPs yield | Advanced by `code_0AF5A4`; drained/cleared in `chunk_0B8000` |
| `$0860` / `$0862` / `$0864` / `$0866` | **Screen edge boundaries** (pixels, world coords): left / top / right / bottom | `[C1]`–`[C4]` compare; tile scan helpers also use `$0860`–`$086C` |
| `$0BC0`–`$0BC8` | **Screen effect state** — `$0BC0`: control (bit 15 = active, 0–14 = type); `$0BC2`/`$0BC4`: params; `$0BC6`: X velocity; `$0BC8`: Y velocity | `[D1]`/`[D2]`/`[D3]` write; `[D4]` waits; engine clears when effect completes |
| `$05C8` | **Player interact capability flags** — tested by `code_03CD92` | `[D7]`/`[D8]`/`[D9]` via `code_03CD92` |
| `$05CA` | **Current interact target** (actor ID, negative = special mode) | `[D7]`/`[D8]` check; `code_03CD92` writes |
| `$05CC` / `$05CE` | **Interact availability flags** — `#$4000` set on interact start; `$05CC` for `[D7]`, `$05CE` for `[D8]`/`[D9]` | `[D7]`/`[D8]` clear; `code_03CD92` sets `$04 \| #$8000` |
| `$05D8` | **Scene lock** — when nonzero, D7–D9 skip interact check | System |
| `$0B12` | **Mode flag** — when negative, `[DA]` uses alternate positioning path with facing flip | System |
| `$0A02,Y` | **Primary party member entity slots** (Y=0,2,4) — entity lookup for position/existence | `[DA]` reads; `[E3]` searches via `code_00D31C`; `[E4]`/`[E5]` search Y=6..10 via `code_00D37F`; `[E8]` reads |
| `$0A08,Y` | **Secondary party member entity slots** — alternate slot array for `$06 bit #$0400` actors | `[E8]` reads for secondary character proximity; `[F5]` registers new members |
| `$05F8` | **Spritemap source pointer** — used by `[F2]` to load party child spritemap | `[F2]` via parent's `code_08F3EA` |
| `$06C5,Y` | **Party member type table** — indexed by `(member-1)*6 + $04`; values classify type for 3-way branch | `[F1]` reads |
| `$0AC2,Y` / `$0ACE,Y` | **Party position cache** — X/Y position snapshots for swap operations | `code_04FE07` writes; `[EF]`/`[F0]` read |
| `$0AF6,Y` | **Swap staging area** — holds `$04` fields of swapping party members | `[ED]`/`[EE]` write; `[EF]`/`[F0]` read |
| `$09F8`–`$0A00` | **Tile-specific movement data** (anim ID bits, velocity components, duration) | `[BE]`/`[BF]`/`[C0]` read when `$30 == #$02` (stairs) |
| `$09BE` | **Current portrait ID cache** — `[CA]` skips reload if ID matches | `[CA]` reads and writes |
| `$0A10,Y` | **Player direction state array** (indexed by `$04`); direction bits masked/set | `[BE]`/`[BF]` via `code_00E4E1`; `[C0]` clears bits |

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


## Actor model

Scene logic runs as **actors**: a 5-byte header plus 65816/COP body.

### On-disk actor record (`us/structs.json` → `actor`)

```
actor < Byte, Byte, Byte, Byte, Byte, Code >
```

Parsed headers: **866**.

### Behavior class (header field 2)

| Class | Count | Inferred role | Typical COP mix |
|-------|-------|---------------|-----------------|
| `#49` | 355 | **NPC / townsfolk** | `[44]` solid, `[22]` action script, `[80]`/`[97]` anim, `[1D]` dialog, `[0B]` flags |
| `#69` | 165 | **Object / trigger / interactable** | `[22]`/`[CB]`, dialog, often `f4≠0` subtype |
| `#68` | 143 | **Scene director / cutscene controller** | `[AA]`/`[AE]` spawn children, `[18]` `request_map`, `[D0]` delays |
| `#48` | 98 | **Animated puppet / prop sprite** | `[80]`–`[98]` animation loops |
| `#42` | 56 | **Enemy / battle actor** | `[E1]`/`[EB]`/`[EC]`/`[E8]` combat family + walk |
| `#60` | 19 | **UI / menu / prologue manager** | `[AC]`/`[AA]` spawn, `[C8]`/`[32]` UI setup |
| `#4A` | 11 | **Door / warp / portal** | Heavy `[73]` + flag gates |
| `#4C` | 9 | **Named character sprite** | `[C9]` + anim |
| `#44` | 4 | **Player / party host** | `[36]` unk21 install, `[AA]` helpers, `$0EEE` |
| `#40` | 1 | **Boot / logo** | Special boot sequence |

### Header field distributions

**Field 0** (spawn subtype / facing seed): `#00` (760), `#01` (41), `#02` (20), `#03` (13), `#10` (5), `#0E` (4), other (23).

**Field 1** (secondary subtype): `#00` (863), `#30` (2), `#10` (1).

**Field 3** (flags): `#00` (709), `#80` (85, common "special/interact" bit), `#20` (61), `#24` (10, mostly `#42` enemy actors), `#A0` (1).

**Field 4** (extra param): `#00` (745), `#01` (99), `#20` (13), `#02` (4), `#10` (3), `#08` (2).

### Flag field semantics (field 3)

| Value | Count | Notes |
|-------|-------|-------|
| `#00` | 709 | Default |
| `#80` | 85 | Common "special/interact" bit (often talkable NPCs & objects) |
| `#20` / `#24` | 61 / 10 | Mostly `#42` enemy actors (`#24`) |
| `#A0` | 1 | Rare combo of `$80\|$20` |

### Behavioral / role types (composition)

| Role | Distinguishing traits | Example |
|------|----------------------|---------|
| Scene player / camera host | Class `#44`, `COP [AA]` helpers, `COP [36]` unk21, toggles `$06`, `STX $0EEE` | `actor_0BD8A1` |
| Walking NPC | Class `#49`, solid + action script + anim + dialog | `actor_07A382` |
| Trigger / examine object | Class `#69`, thin scripts, flag gates | `actor_0783A6` |
| Cutscene director | Class `#68`, spawns children, `request_map` `[18]` | `actor_04EE8B` |
| Enemy | Class `#42`, combat COP `$E*` range | `chunk_02E9AA` actors |
| Door/warp | Class `#4A`, `COP [73]` | mansion foyer actors |
| System helper | Shared via many script_meta scenes | `actor_04B763`, `actor_04B3D8` |

### Top header combinations

| Header | Count |
|--------|-------|
| `actor < #00, #00, #49, #00, #00, {…} >` | 262 |
| `actor < #00, #00, #68, #00, #00, {…} >` | 128 |
| `actor < #00, #00, #69, #00, #01, {…} >` | 83 |
| `actor < #00, #00, #69, #80, #00, {…} >` | 62 |
| `actor < #00, #00, #48, #00, #00, {…} >` | 57 |
| `actor < #00, #00, #42, #20, #00, {…} >` | 46 |
| `actor < #01, #00, #49, #00, #00, {…} >` | 27 |
| `actor < #00, #00, #49, #80, #00, {…} >` | 22 |
| `actor < #00, #00, #60, #00, #00, {…} >` | 17 |
| `actor < #00, #00, #69, #00, #00, {…} >` | 11 |

### Scene spawn entry types (`script_meta`)

Each scene list (`unk1_XXXXXX`) is a sequence of discriminated records:

| Kind | Disc. | Payload | Role |
|------|-------|---------|------|
| `unk1` (`spawn_full`) | `0x00` | `u8×5, @actor, @unk11` | Full spawn: params + actor + spritemap/hitbox (`unk11`) |
| `unk2` (`spawn_simple`) | `0xFE` | `u8, @actor` | Lightweight spawn (param + actor only) |
| `unk3` (`spawn_xy`) | `0xFD` | `u8, u8, u8, @actor` | Positioned spawn (X, Y, slot/id + actor) |
| `unkFC` (`spawn_full_alt`) | `0xFC` | same width as unk1 | Rare full-spawn variant |
| delimiter | `0xFF` | — | End of scene actor list |

Counts: `unk1` (1252), `unk3` (855), `unk2` (481), `unkFC` (2).

Related: `unk11` bundles spritemap (`part0`), sprite group bits (`part1`/`part2`), and collision/box (`part3`/`part4`).

## Opcode roster (`$00`–`$FA`)

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
| `50` | `redraw_tile_rows` | 128 | [metatiles](families/metatiles.md) |
| `51` | `step_begin` | 662 | [movement](families/movement.md) |
| `52` | `step_end` | 662 | [movement](families/movement.md) |
| `53` | `walk_to_x` | 202 | [movement](families/movement.md) |
| `54` | `walk_to_y` | 281 | [movement](families/movement.md) |
| `55` | `walk_seeks` | 44 | [movement](families/movement.md) |
| `56` | `claim_id` | 31 | [tracked_ids](families/tracked_ids.md) |
| `57` | `release_id` | 25 | [tracked_ids](families/tracked_ids.md) |
| `58` | `branch_if_slots_below` | 6 | [tracked_ids](families/tracked_ids.md) |
| `59` | `set_focus_bind` | 12 | [focus_interact](families/focus_interact.md) |
| `5A` | `branch_if_id_claimed` | 8 | [tracked_ids](families/tracked_ids.md) |
| `5B` | `branch_if_focus_id` | 73 | [tracked_ids](families/tracked_ids.md) |
| `5C` | `add_gp` | 7 | [currency](families/currency.md) |
| `5D` | `spend_gp` | 7 | [currency](families/currency.md) |
| `5E` | `branch_if_can_afford` | 4 | [currency](families/currency.md) |
| `5F` | `load_shop_inventory` | 7 | [shop](families/shop.md) |
| `60` | `award_exp` | 0 | [progression](families/progression.md) |
| `61` | `branch_if_level_ge` | 35 | [progression](families/progression.md) |
| `62` | `branch_if_companions` | 233 | [party_check](families/party_check.md) |
| `63` | `wait_facing` | 311 | [interact_wait](families/interact_wait.md) |
| `64` | `wait_facing_anim` | 23 | [interact_wait](families/interact_wait.md) |
| `65` | `open_status_menu` | 4 | [menu](families/menu.md) |
| `66` | `open_robot_config_menu` | 3 | [menu](families/menu.md) |
| `67` | `save_game` | 3 | [menu](families/menu.md) |
| `68` | `camera_scroll` | 44 | [camera](families/camera.md) |
| `69` | `camera_return` | 10 | [camera](families/camera.md) |
| `6A` | `screen_shake` | 15 | [camera](families/camera.md) |
| `6B` | `camera_scroll_await` | 2 | [camera](families/camera.md) |
| `6C` | `spawn_screen_effect` | 6 | [camera](families/camera.md) |
| `6D` | `camera_y_shake` | 45 | [camera](families/camera.md) |
| `6E` | `npc_spawn_gate` | 15 | [npc_lifecycle](families/npc_lifecycle.md) |
| `6F` | `npc_idle_guard` | 14 | [npc_lifecycle](families/npc_lifecycle.md) |
| `70` | `npc_busy_wait` | 0 | [npc_lifecycle](families/npc_lifecycle.md) |
| `71` | `combat_solid_gate` | 13 | [combat](families/combat.md) |
| `72` | `combat_result_poll` | 31 | [combat](families/combat.md) |
| `73` | `encounter_gate` | 44 | [combat](families/combat.md) |
| `74` | `gate_flag_expr` | 108 | [spawn_gate](families/spawn_gate.md) |
| `75` | `gate_flag` | 271 | [spawn_gate](families/spawn_gate.md) |
| `76` | `gate_map` | 6 | [spawn_gate](families/spawn_gate.md) |
| `77` | `branch_if_counter` | 11 | [bcd_counter](families/bcd_counter.md) |
| `78` | `set_counter` | 8 | [bcd_counter](families/bcd_counter.md) |
| `79` | `spawn_effect` | 7 | [spawn_effect](families/spawn_effect.md) |
| `7A` | `branch_x_3way` | 7 | [proximity_3way](families/proximity_3way.md) |
| `7B` | `branch_y_3way` | 2 | [proximity_3way](families/proximity_3way.md) |
| `7C` | `companion_sprite_reset` | 21 | [companion_sprite](families/companion_sprite.md) |
| `7D` | `companion_sprite_set` | 2 | [companion_sprite](families/companion_sprite.md) |
| `7E` | `resume_deferred_interact` | 5 | [focus_interact](families/focus_interact.md) |
| `7F` | `unused_crash` | 0 | [unused_ops](families/unused_ops.md) |
| `80` | `set_anim` | 1247 | [anim_setup](families/anim_setup.md) |
| `81` | `set_anim_vx` | 78 | [anim_setup](families/anim_setup.md) |
| `82` | `set_anim_vy` | 57 | [anim_setup](families/anim_setup.md) |
| `83` | `set_anim_vxy` | 8 | [anim_setup](families/anim_setup.md) |
| `84` | `set_anim_spd` | 354 | [anim_setup](families/anim_setup.md) |
| `85` | `set_anim_spd_vx` | 149 | [anim_setup](families/anim_setup.md) |
| `86` | `set_anim_spd_vy` | 220 | [anim_setup](families/anim_setup.md) |
| `87` | `set_anim_spd_vxy` | 2 | [anim_setup](families/anim_setup.md) |
| `88` | `set_anim_step` | 2 | [anim_setup](families/anim_setup.md) |
| `89` | `set_anim_facing` | 60 | [anim_setup](families/anim_setup.md) |
| `8A` | `set_anim_spd_facing` | 2 | [anim_setup](families/anim_setup.md) |
| `8B` | `set_anim_sprmap` | 33 | [anim_setup](families/anim_setup.md) |
| `8C` | `set_anim_accel` | 8 | [anim_setup](families/anim_setup.md) |
| `8D` | `spawn_child_guarded` | 5 | [child_sprite](families/child_sprite.md) |
| `8E` | `spawn_child_guarded_w` | 10 | [child_sprite](families/child_sprite.md) |
| `8F` | `spawn_child` | 40 | [child_sprite](families/child_sprite.md) |
| `90` | `spawn_child_w` | 5 | [child_sprite](families/child_sprite.md) |
| `91` | `set_sprmap_render` | 55 | [render_config](families/render_config.md) |
| `92` | `set_sprmap_render_spd` | 7 | [render_config](families/render_config.md) |
| `93` | `spawn_render_actor` | 20 | [render_config](families/render_config.md) |
| `94` | `spawn_render_actor_spd` | 12 | [render_config](families/render_config.md) |
| `95` | `set_bitmap_overlay` | 5 | [render_config](families/render_config.md) |
| `96` | `set_bitmap_overlay_spd` | 0 | [render_config](families/render_config.md) |
| `97` | `wait_anim_done` | 2076 | [anim_wait](families/anim_wait.md) |
| `98` | `wait_anim_frames` | 931 | [anim_wait](families/anim_wait.md) |
| `99` | `wait_anim_clear_sprmap` | 33 | [anim_wait](families/anim_wait.md) |
| `9A` | `anim_until_interact_destroy` | 46 | [anim_wait](families/anim_wait.md) |
| `9B` | `anim_step_tick` | 2 | [anim_wait](families/anim_wait.md) |
| `9C` | `child_wait` | 53 | [anim_wait](families/anim_wait.md) |
| `9D` | `copy_oam_block` | 6 | [render_config](families/render_config.md) |
| `9E` | `sprmap_render_wait` | 75 | [render_config](families/render_config.md) |
| `9F` | `sprmap_render_wait_multi` | 19 | [render_config](families/render_config.md) |
| `A0` | `bitmap_render_wait` | 5 | [render_config](families/render_config.md) |
| `A1` | `bitmap_render_wait_multi` | 0 | [render_config](families/render_config.md) |
| `A2` | `spawn_actor_head` | 22 | [actor_spawn](families/actor_spawn.md) |
| `A3` | `spawn_actor_child` | 2 | [actor_spawn](families/actor_spawn.md) |
| `A4` | `spawn_actor_child_flags` | 0 | [actor_spawn](families/actor_spawn.md) |
| `A5` | `spawn_actor_child_offset` | 3 | [actor_spawn](families/actor_spawn.md) |
| `A6` | `spawn_actor_child_offset_flags` | 0 | [actor_spawn](families/actor_spawn.md) |
| `A7` | `spawn_actor_child_xy` | 0 | [actor_spawn](families/actor_spawn.md) |
| `A8` | `spawn_actor_child_xy_flags` | 0 | [actor_spawn](families/actor_spawn.md) |
| `A9` | `spawn_render_head` | 14 | [actor_spawn_render](families/actor_spawn_render.md) |
| `AA` | `spawn_render_child` | 206 | [actor_spawn_render](families/actor_spawn_render.md) |
| `AB` | `spawn_render_child_counter` | 43 | [actor_spawn_render](families/actor_spawn_render.md) |
| `AC` | `spawn_render_child_flags` | 138 | [actor_spawn_render](families/actor_spawn_render.md) |
| `AD` | `spawn_render_child_offset` | 247 | [actor_spawn_render](families/actor_spawn_render.md) |
| `AE` | `spawn_render_child_offset_flags` | 110 | [actor_spawn_render](families/actor_spawn_render.md) |
| `AF` | `spawn_render_child_xy` | 24 | [actor_spawn_render](families/actor_spawn_render.md) |
| `B0` | `spawn_render_child_xy_flags` | 4 | [actor_spawn_render](families/actor_spawn_render.md) |
| `B1` | `spawn_render_child_offset_counter` | 33 | [actor_spawn_render](families/actor_spawn_render.md) |
| `B2` | `destroy_self` | 534 | [actor_destroy](families/actor_destroy.md) |
| `B3` | `destroy_self_and_children` | 6 | [actor_destroy](families/actor_destroy.md) |
| `B4` | `set_velocity_x` | 10 | [velocity_set](families/velocity_set.md) |
| `B5` | `set_velocity_y` | 0 | [velocity_set](families/velocity_set.md) |
| `B6` | `set_velocity_xy` | 0 | [velocity_set](families/velocity_set.md) |
| `B7` | `adjust_pos_x` | 24 | [position_adjust](families/position_adjust.md) |
| `B8` | `adjust_pos_y` | 27 | [position_adjust](families/position_adjust.md) |
| `B9` | `adjust_pos_xy` | 21 | [position_adjust](families/position_adjust.md) |
| `BA` | `check_tile_right` | 2 | [tile_collision](families/tile_collision.md) |
| `BB` | `check_tile_left` | 2 | [tile_collision](families/tile_collision.md) |
| `BC` | `check_tile_up` | 2 | [tile_collision](families/tile_collision.md) |
| `BD` | `check_tile_down` | 4 | [tile_collision](families/tile_collision.md) |
| `BE` | `move_response_horiz` | 2 | [player_move_response](families/player_move_response.md) |
| `BF` | `move_response_vert` | 2 | [player_move_response](families/player_move_response.md) |
| `C0` | `move_response_idle` | 1 | [player_move_response](families/player_move_response.md) |
| `C1` | `branch_screen_top` | 3 | [screen_edge_branch](families/screen_edge_branch.md) |
| `C2` | `branch_screen_bottom` | 3 | [screen_edge_branch](families/screen_edge_branch.md) |
| `C3` | `branch_screen_left` | 3 | [screen_edge_branch](families/screen_edge_branch.md) |
| `C4` | `branch_screen_right` | 3 | [screen_edge_branch](families/screen_edge_branch.md) |
| `C5` | `set_sprite_priority` | 54 | [sprite_attribs](families/sprite_attribs.md) |
| `C6` | `set_sprite_palette` | 33 | [sprite_attribs](families/sprite_attribs.md) |
| `C7` | `set_sprite_nametable` | 24 | [sprite_attribs](families/sprite_attribs.md) |
| `C8` | `load_spritemap` | 73 | [render_source_load](families/render_source_load.md) |
| `C9` | `load_bitmap` | 24 | [render_source_load](families/render_source_load.md) |
| `CA` | `load_portrait` | 51 | [render_source_load](families/render_source_load.md) |
| `CB` | `mark_resume` | 744 | [script_yield](families/script_yield.md) |
| `CC` | `yield` | 393 | [script_yield](families/script_yield.md) |
| `CD` | `yield_to_delay` | 6 | [script_yield](families/script_yield.md) |
| `CE` | `yield_to` | 7 | [script_yield](families/script_yield.md) |
| `CF` | `set_resume` | 151 | [script_yield](families/script_yield.md) |
| `D0` | `delay_frames` | 762 | [script_yield](families/script_yield.md) |
| `D1` | `start_screen_effect` | 34 | [screen_effect](families/screen_effect.md) |
| `D2` | `start_screen_effect_vx` | 12 | [screen_effect](families/screen_effect.md) |
| `D3` | `start_screen_effect_vy` | 21 | [screen_effect](families/screen_effect.md) |
| `D4` | `wait_screen_effect` | 2 | [screen_effect](families/screen_effect.md) |
| `D5` | `init_anim_spritemap` | 26 | [anim_source_init](families/anim_source_init.md) |
| `D6` | `init_anim_spritemap_spd` | 2 | [anim_source_init](families/anim_source_init.md) |
| `D7` | `player_idle_facing` | 1 | [player_idle](families/player_idle.md) |
| `D8` | `player_idle` | 58 | [player_idle](families/player_idle.md) |
| `D9` | `player_idle_base` | 3 | [player_idle](families/player_idle.md) |
| `DA` | `calc_target_pos` | 33 | [smooth_move](families/smooth_move.md) |
| `DB` | `setup_smooth_move` | 42 | [smooth_move](families/smooth_move.md) |
| `DC` | `exec_smooth_move` | 42 | [smooth_move](families/smooth_move.md) |
| `DD` | `toggle_facing` | 24 | [facing_control](families/facing_control.md) |
| `DE` | `toggle_vflip` | 0 | [facing_control](families/facing_control.md) |
| `DF` | `face_right` | 21 | [facing_control](families/facing_control.md) |
| `E0` | `face_left` | 20 | [facing_control](families/facing_control.md) |
| `E1` | `face_toward` | 103 | [facing_control](families/facing_control.md) |
| `E2` | `proximity_branch_toward` | 0 | [facing_control](families/facing_control.md) |
| `E3` | `branch_party_slot` | 57 | [party_ai](families/party_ai.md) |
| `E4` | `branch_no_prev_partner` | 17 | [party_ai](families/party_ai.md) |
| `E5` | `branch_no_next_partner` | 17 | [party_ai](families/party_ai.md) |
| `E6` | `branch_if_state` | 20 | [party_ai](families/party_ai.md) |
| `E7` | `set_state_yield` | 19 | [party_ai](families/party_ai.md) |
| `E8` | `branch_party_near` | 90 | [party_ai](families/party_ai.md) |
| `E9` | `branch_party_near_behind` | 0 | [party_ai](families/party_ai.md) |
| `EA` | `tile_scan_classify` | 17 | [party_step](families/party_step.md) |
| `EB` | `party_step_start` | 91 | [party_step](families/party_step.md) |
| `EC` | `party_step_tick` | 91 | [party_step](families/party_step.md) |
| `ED` | `swap_prev_start` | 67 | [party_swap](families/party_swap.md) |
| `EE` | `swap_next_start` | 67 | [party_swap](families/party_swap.md) |
| `EF` | `swap_prev_exec` | 67 | [party_swap](families/party_swap.md) |
| `F0` | `swap_next_exec` | 67 | [party_swap](families/party_swap.md) |
| `F1` | `branch_party_type` | 15 | [party_render](families/party_render.md) |
| `F2` | `init_party_render_facing` | 8 | [party_render](families/party_render.md) |
| `F3` | `init_party_render_sfx` | 27 | [party_render](families/party_render.md) |
| `F4` | `init_party_render` | 81 | [party_render](families/party_render.md) |
| `F5` | `register_party_member` | 4 | [party_register](families/party_register.md) |
| `F6` | `init_anim_with_remap` | 4 | [anim_frame_remap](families/anim_frame_remap.md) |
| `F7` | `reset_party_state` | 6 | [party_state_reset](families/party_state_reset.md) |
| `F8` | `set_orbit_accum` | 4 | [orbital_motion](families/orbital_motion.md) |
| `F9` | `orbit_step` | 8 | [orbital_motion](families/orbital_motion.md) |
| `FA` | `child_render_yield` | 25 | [child_render_tick](families/child_render_tick.md) |

## Example sketches

Short patterns spanning families (see family pages for full evidence):

```asm
    ; typical NPC actor (class #49)
actor_XXXXXX [
  actor < #00, #00, #49, #80, #00, {
    COP [74] ( #$1169, #$0087 )      ; gate_flag_expr — spawn gate
    COP [0B] ( #$818D, &on_talk )    ; branch_if_flag
    COP [0C] ( #$1034, #$0087, &alt )
  } >
]

on_talk:
    COP [22] ( &idle_loop )          ; set_interact
    COP [1D] ( &string_XXXX )        ; show_dialog
    COP [0A] ( #$8014 )              ; set_flag
    RTL
```

```asm
    ; talkable NPC (minimal)
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
```

```asm
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

```asm
    ; party member swap sequence (system)
    COP [E3] ( &prev, &own, &next )   ; branch_party_slot
prev:
    COP [ED] ( &completion )           ; swap_prev_start
    COP [EF]                           ; swap_prev_exec
    BRA loop
next:
    COP [EE] ( &completion )           ; swap_next_start
    COP [F0]                           ; swap_next_exec
    BRA loop
```

## Related documents

| Doc | Role |
|-----|------|
| [index.md](index.md) | This overview (canonical reference for `$00`–`$FA`) |
| [families/](families/) | Per-family deep dives (64 docs, `$00`–`$FA`) |
| [../cop_actor_analysis.md](../cop_actor_analysis.md) | Legacy workspace — regeneration notes |
| `us/copdef.json` | Operand layouts |
| `extracted/system/chunk_008000.asm` | Handlers / jump table |
| `scripts/split_cop_docs.py` | Historical splitter — **do not** rebuild family bodies from the monolith |
