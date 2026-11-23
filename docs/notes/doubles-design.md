# Doubles (2 vs 2): design note

Status: built, 2026-11-21 (see "As built" at the end). First deliverable: **1 human + 1 CPU partner vs 2 CPUs**, in the web build.
Out of scope for now: online 2v2, four humans, a second human on one screen.

## Hard constraints

- `lab.doubles == false` (the default) must leave singles **byte-for-byte unchanged**: same RNG draws in the same order, same state transitions, same numbers. Every doubles branch is guarded by the flag; shared helpers are refactored so singles passes the same arguments as before.
- `Lab` keeps one human (`player`) and the far-side `cpu`. Doubles *adds* fields; nothing is renamed or removed.
- No change to the two-player link (`remote`) paths. `lab_start_remote` never sets `doubles`.

## Who is on court

| Team | Player | Struct | Ready spot (x, baseline) |
|---|---|---|---|
| near (0) | human | `lab.player` | x = -2.74 (right-hand court from its view; right = -x) |
| near (0) | CPU partner | `lab.partner` (new) | x = +2.74 |
| far (1) | CPU A | `lab.cpu` | x = +2.74 (its right court) |
| far (1) | CPU B | `lab.cpu2` (new) | x = -2.74 |

2.74 = `COURT_DOUBLES_HALF_W / 2`. Ready spots are the fixed receiving halves (see below). Teammates are kept ~1.4 m apart by a simple "the one not playing the ball steps aside" push, no collisions.

`lab_start_doubles(lab, seed, right_handed, cpu_level, partner_level)` calls `lab_start_rally`, sets `doubles = true`, inits `partner` (facing +1) and `cpu2` (facing -1), and sets `pskill = cpu_skill(partner_level)`.

## Who returns which ball

Decided **once per incoming ball**, when its path is predicted (`predict_path`), from where the ball will first bounce on that side (`path[path_bounce].x`, else the last path point):

- Near side: `near_owner` = partner if `|bx - partner.x| + 0.4 < |bx - human.x|`, else human (ties and "in between" go to the human, who is the one the player is steering). Because the owner is picked from *current* positions, the human can claim a ball by standing over it.
- Far side: `cpu_hitter` = whichever of `cpu` / `cpu2` is nearer to the bounce x. No bias.

Consequences:
- Human owner: exactly today's behaviour (assist-run, timing window against `arrival_t`, miss call after `arrival_t + LAB_SWING_GRACE`).
- Partner owner: the human's auto-run is off (it drifts to its ready spot, the D-pad still works), the partner runs to its own meeting point (`p_arr_*`, a second copy of the arrival state; `arrival_for` is split into `arrival_calc` writing through pointers, with the old wrapper writing `lab->arrival_*`), swings at `p_arr_t ± pskill.timing_err` and hits with the CPU stroke code. The miss call (point lost) uses the owner's arrival time and z.
- **Poaching works**: a human swing at a ball the partner owns is judged as usual (reach + the human's own timing window). Whichever swing happens first wins; once the state leaves `LAB_INCOMING` the other one is ignored.
- The CPU stroke code (`cpu_hit`) is generalised to take the hitting `Player *` and its facing. For facing +1 (the partner) the azimuth sign is flipped and the aim assist is not mirrored through the net post line.
- The same code decides *who* swings; the animations key off per-cat hit counters (below).

## Court width

`court_in_doubles(Vec3, z_sign)` (new, `core/court.c`): `|x| <= COURT_DOUBLES_HALF_W + BALL_RADIUS`, same length rule. In `advance_vs_cpu` the two `court_in_singles` calls become `in_court(lab, ...)` which picks doubles or singles. **Serves keep the singles service boxes** (a doubles serve box is not wider), so the serve-box check is unchanged except for the side below. Net posts are already at the doubles width. The CPU stroke chooser and aim assist still aim inside the singles lines (a safe, slightly conservative target; doubles alleys are used by the human's / partner's wider shots and by lucky CPU ones).

## Serve rotation and receiving order

Standard doubles rules, with the existing `Score` (games alternate server between *teams*):

- `serve_rot[team]` counts the service games each team has played. Server in team `t`'s next service game = player `serve_rot[t] & 1` (team 0: 0 human, 1 partner; team 1: 0 `cpu`, 1 `cpu2`). Order over a set: human, CPU A, partner, CPU B, human... It is bumped in `end_point` when `score.game_just_won`.
- Serving side alternates with the points played in the game: even total points = deuce (right) court, odd = ad (left). `serve_tx` (+1 / -1) is the sign of the target box's x for a near-side serve (+1 always in singles, so `x * serve_tx` and `rng * serve_tx` are exact no-ops there). Near server stands at `x = -serve_tx * 1.2`; far server at `x = +serve_tx * 1.2`; the receiving ball lands on the opposite side.
- Receiving order: fixed by court half. The right-hand court receiver is always the same player; the ownership rule above means the player whose half the serve lands in takes it, naturally. (Swapping receivers at the start of each set is not modelled: a match is one set.)
- Human serve: unchanged mechanics (toss, swing), only the side alternates. Partner serve: the partner "tosses and hits" instantly (`partner_serve`): ball placed at contact height at its racket, launched with `solve_launch` at the target box with CPU-level speed noise; counts as a serve (`serve_ball`, two-fault rule: first fault re-serves, second loses the point). CPU serves stay the existing "feed" shot, now alternating sides and coming from the serving cat's x.

## State array

`S_COUNT` grows; **new entries are appended after `S_WAITSERVE`**, so every existing index is unchanged. `STATE_NAMES` in `web/game/core.js` gets the same names in the same order (`oc_state_len` is checked at load).

New: `S_DOUBLES`, `S_PARTNER_X`, `S_PARTNER_Z`, `S_CPU2_X`, `S_CPU2_Z`, `S_PARTNER_HITS`, `S_CPU2_HITS`, `S_NEAR_OWNER` (0 human / 1 partner), `S_FAR_HITTER` (0 cpu / 1 cpu2), `S_SERVER_PLAYER` (0 / 1: which cat of the serving team serves).

Hit counters: `hits` = near-team hits, `cpuHits` = far-team hits (so rally counts, audio, stats and challenge code keep working unchanged), `partnerHits` and `cpu2Hits` are the subsets made by the partner / CPU B. The renderer swings the human on `hits - partnerHits`, the CPU A on `cpuHits - cpu2Hits`. (Known simplification: `lab.last` and the shot stats describe the human's last hit only.)

`oc_init_doubles(seed, right_handed, arcade, cpu_level, partner_level)` is the new export (added to `EXPORTS` in `web/Makefile`).

## Camera

`core/camera.c` is untouched. For doubles `wasm_api.c` feeds it a copy of the human at the **team's mean x** and reports `camFov + 5` so the alleys fit. Verified visually, not by unit test.

## Web side

- Menu: **Doubles** under *More modes* (`modeItems`). Flow: pick your cat -> pick your partner (`cat3`) -> court -> launch. The two opponents are the next two cats not already used. Event ids `'doubles-pick'` and `'doubles'`, mirroring `tourney`. Back navigation follows the 2P pattern.
- Settings `cat3` (partner) and `cat4` (opponent B) added to `DEFAULTS` / `LIMITS` (existing `cleanSettings` test expectation is updated, defaults only).
- `world.js`: two extra cats (`partnerCat`, `cpu2Cat`) built only when doubles; `update()` positions and animates them from the new state fields, uses per-cat swing counters, extends the run-dust and trail loops. Emote, trophy and tantrum keep the human/CPU-A pair as the team representatives.
- HUD: names `A & B` for each team. Scoreboard stays team vs team.
- Not tested with a real phone: only the keyboard/D-pad and a scripted swing in the browser. The phone swing path is the same `lab_swing` entry point, so it should work, but it was not exercised.

## Tests

C (`tests/test_doubles.c`): singles unchanged (a seeded singles match with `doubles=false` gives an identical event log before/after the change is guaranteed by running the pre-existing suite plus a golden hash recorded from the singles baseline); `court_in_doubles`; partner and cpu2 ready positions; ownership by bounce x; ownership flips when the human walks over; serve order human -> A -> partner -> B; serve side alternation and target box sign; partner serve lands in the box; a full doubles match terminates with a winner and every point is attributed.
JS: menu flow and back-navigation tests, `STATE_NAMES` length vs the C enum, `cleanSettings` defaults.

## As built (differences from the plan above)

- Stats: instead of a flag, the web page feeds stats, impact effects and the effort grunt a copy of the state whose `hits` excludes the partner (`humanOnly` in `game.js`), and skips `recordMatch`. `session.js` likewise ignores partner hits for the phone's shot label.
- A server stays where it stands during the toss: the idle "drift back to the ready spot" is skipped in `LAB_SERVE` when doubles is on.
- The partner plays at the opponents' CPU level (`initDoubles(..., level, level)`).
- `?games=N` (any mode) sets the match length; used for the browser check.
- Menu: `doubles` sits after `party` in More modes (so Wardrobe/Career moved down one slot), `cat3`/`cat4` are validated in `cleanSettings` but not defaults, and `doublesLineup()` in `menu.js` picks the opponents.
- Verified: `make test` (C, `-Werror`), `make -C web test`, and one full 1-game match in the browser (human script via `demoSwing`). Not verified: a real phone, a long (4-game) doubles match by hand, the doubles camera at other window shapes.
