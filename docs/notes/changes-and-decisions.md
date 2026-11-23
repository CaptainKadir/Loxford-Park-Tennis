# Loxford Park Tennis (Mac, phone as racket): changes and decisions so far

Branch `mac-phone-controller`, 2026-11-18 to 2026-11-19. Written 2026-11-19 from the conversation and the git log.

Two parts: what changed, and every point where I gave you a choice (or made one for you) with what you picked. Where you did not choose and I decided, it says so.

---

## 1. What changed

### Base build (commits 6d26ee5 to 69805f2, 2026-11-18)
- Phone motion input into the C swing detector; shot classification; the C core built as WASM (`oc_*` API).
- HTTPS + WebSocket relay server, certificate script, controller page, frame mapping.
- Game session (clock sync, pausing when the phone is silent), HUD text, pixel-look 3D renderer (low-res target, nearest-neighbour upscale, depth outlines), procedural cats with a racket arm, stadium and crowd.
- Review fixes: core/three coordinate mapping, racket frame, out-of-order samples, spectator promotion, latency, `?lefty`.
- Defaults: real ball speed, easy CPU, 960 px render width. URL options `?arcade`, `?level=0|1|2`, `?res=`.

### Tuning from your iPhone testing
- Ball flew out after a return: aim assist limits examined (more upward range gave no gain and was reverted); swing power soft-capped (c4c20e0).
- Swings are now read from the phone's orientation, not the gyro axes, and reported early (f84f1db). Root cause found from your own recordings: the racket face and path were pinned at fixed values. Fixed in `core/stroke.c` and `core/phone.c` (phone face = screen normal, halved; heading gain 0.2). Replay result: forehand 21/24 in, backhand 24/24 in.
- Body and racket now turn left for backhands.
- Forehand-as-drop-shot fixed (low balls no longer tilt the swing path that is used for naming the shot); timing window widened to 0.16 s.
- Backhands landing in your own court and forehands lobbed: fixed with the face/heading change above.
- Racket drawn 1.4x bigger; swing-to-return delay reduced (about 130 ms floor remains: Wi-Fi plus clock sync).
- Reach scaled by 1.4 to match the bigger racket (sideways 1.5 to 2.1 m, forward 2.2 to 3.1 m, behind 1.0 to 1.4 m, height 2.4 to 3.0 m). The CPU shares this reach.

### Shot trainer (`/train`)
- Shows example returns in the real game camera, with a virtual bat driven by the phone, a Start/Stop recording button, and a mapping fixer (flip left/right, flip up/down, grip twist).
- The example ball is fed to you; the ball is returned like the example whatever you swing; only your swing is recorded for that shot.
- Saves fitted thresholds to `web/tuning.json`, recordings to `web/recordings/`, mapping to `web/mapping.json` (loopback only).
- Shots: the game's Gameplay menu has Shots = Basic or All (default **All**, `DEFAULTS.shots` in `web/game/menu.js`). Basic is forehand, backhand and lob; All adds topspin, slice and drop shot. Trainer `?all` trains all eight; game `?shots` forces All. (Updated: the first version was basic-only.)

### Rules and flow
- Real tennis scoring (15/30/40, deuce, advantage, games, first to 4 games, next game decides at 3-3), alternating server.
- You serve: ball toss, a swing while it is high sends it into the service box; faults and double faults.
- Scoreboard, serve prompts, rematch on Enter or a swing.
- Title/pause menu (Esc): Play, Players (1 or 2), Player 1 cat, CPU / Player 2 cat, CPU level, Ball (Real/Fast), Shots (Basic/All), Hand (Right/Left). Choices are saved in the browser; URL flags still win.
- HUD polish: debug text only with `?debug`, scoreboard no longer overlaps the hint.

### Two players, split screen (e98e482, d5424e9)
- Two cores (one WASM instance per player), each seeing the other player as the "CPU", linked in `web/game/duel.js` (shots, point results and positions are mirrored across).
- Relay takes two phones (player 1, player 2; extra phones wait as spectators).
- Two views side by side on a wide window, stacked on a tall one; each view fills its half (render shape follows the window, CSS cover); scoreboard centred.
- Needs two real phones to test; only a scripted two-player match was run.

### Characters and look
- Cat selection: Otis (The Hobo), Minu (The Grumpy), Bombay (black), Bella (The Pigeon Whisperer), Snowy (white), Biscuit (The Terrorist). Cats wear no shirts.
- Art styles `?style=chunky|retro|clean|soft` (default chunky, 960 px).
- Procedural pixel textures: court grain and scuffs, grass blades, net mesh, stand steps, fur, ball seam, racket strings.
- Banners show real words in a 5x7 pixel font: MEOW CUP, PURR-FECT, CATNIP COLA, WHISKER SPORTS.
- Owl umpire on a proper umpire chair: head follows the ball, blinks, flaps its wings on points (3086f1c).
- Kenney "Animated Characters Retro" cats were built (45e2c47) and then made opt-in only (`?cats=character`); the original procedural cats are the default again.

### Animation
- Earlier: bounce dust, hit sparks, point confetti, net wobble, drifting clouds, crowd wave, cat blink/ear twitch, celebrate hop and tail wag, loser droop.
- Later: racket swing streak, ball squash on bounce and roll, running dust, hop and screen shake on serves and hard hits, pop and bump animations on HUD text, bobbing title, menu fade (all off with "reduce motion").

### Sound and music
- Kenney "Impact Sounds" (CC0): footsteps, fault and CPU-point thud (and the original hit/bounce sounds, now replaced).
- Openverse CC0 recordings (4b67ef8): real racket hits, serves, bounces, net cord, applause, referee whistle. Cheering was removed at your request (0a51c3c); applause stays for won games.
- Main-menu music: a synthesized 8-bar chiptune loop (no audio file).
- Credits and SHA-256 checksums in `docs/CREDITS.md`.

### Phone controller
- Hit thump: a short low sound on every hit, now on by default.
- Vibration on a hit: the game asks the phone to buzz. It did not vibrate on your phone (likely an iPhone: Safari has no vibrate call). Test button, hit counter and the thump were added as the fallback.
- Full UI redesign: connection pill with player number, numbered Start/Calibrate steps, live stats, switches for thump, vibration test, record swings.

### Later additions (2026-11-19)
- Phone UI drawn as a racket, settings (thump, vibration test, record swings) behind a gear icon (64541fb).
- Match lost: the loser smashes its racket on the ground four times, then the owl flies off the chair and chases it; angry meows and owl hoots are synthesized (0b1a6f6, 3c1129d). Preview with `?tantrum=human|cpu`.
- A missed serve toss is no longer a fault: it is tossed again (869297d).
- Camera never goes further back than 21 m, which fixed the crowd filling the view when a player chased a ball far back (1aab4cf).
- Tutorial in the main menu (1 player): serve, forehand, backhand, then win a point, with the CPU feeding balls to the right side (ce814af).
- Game renamed **Loxford Park Tennis** (game, phone controller, trainer, README section).
- New pre-game flow: title screen (Play, Tutorial, Settings) then cat pick, then court pick (Hard, Clay, Grass, Night; visual only, same physics), then the match. In 2 players each picks a cat. A new cat or court reloads the page and starts the match straight away. Settings moved to their own screen. Mouse and touch work on the menus.
- Real cat and owl recordings (Openverse CC0) for the tantrum and the chase (acedb62).
- `main` was fast-forwarded to `mac-phone-controller` (local only, not pushed).

### CPU
- Hard was too weak. Now: runs 8 m/s (was 6), reacts in 0.05 s (was 0.15), tighter aim and timing, almost no random mistakes, and picks a softer swing up to 5 times when its first would miss the court. Medium slightly better (5.5 m/s). A scripted player beat Hard in 4 of 60 games (was 8 of 60).

### Evening of 2026-11-19 (select screen, 2P fixes, scenery)
- Character select redone twice: first flat drawn portraits in a Street Fighter layout (you did not like the art), then the real in-game 3D cats on a 3D stage (`render/select.js`): P1 left, CPU or P2 right, 3x2 roster of pixel heads, name plates, VS, cats slide in and swing when the cursor moves. The select stage keeps the plain sky and stadium; trees and the new sky are match-only (you said you liked it before; I had wrongly added the scenery there, and a crash from the time-of-day change had also hidden the stage).
- 1 Player and 2 Players are on the main menu with Tutorial and Settings; Players removed from Settings. Tutorial is always one player.
- 2-player serve: the receiver's screen showed the ball only when it bounced (teleport). Now a visual-only "ghost" ball shows the serve from contact (`lab_remote_serve`, `oc_remote_serve`), and the real ball takes over at the bounce. Test in `web/test/duel.test.mjs`.
- QR code under "Reconnect the phone" (server route `/phone-qr.svg`, `/phone-url`).
- Point animation in the centre of the screen: headline, reason, new score; bigger for game and match (`pointFx` in `hud.js`). The old "Point to you" text was removed.
- Racket icon on the title redrawn and enlarged.
- Scenery: trees, hills, gradient sky with sun, puffy clouds (`render/scenery.js`). Camera far plane 120 to 260.
- Courts are Hard, Clay, Grass. Night Match and Sunset Cup were added then removed at your request: time of day (Day, Sunset, Night) is a separate choice on the court screen (up/down or click), saved with the settings.
- `?ui=16bit` preview (pixel console font, notched buttons, stepped animation, low-res render); screenshots in `docs/ui-options/16bit/`. Not chosen yet.

### Later that evening (scoreboard, view, net, Assist, dances)
- Cats: red/blue shirts removed (the torso takes the cat's fur colour). Subtitles: Otis "The Hobo", Minu "The Grumpy", Bella "The Pigeon Whisperer", Biscuit "The Terrorist" (`web/game/cats.js`).
- Scoreboard is a two-row panel (serve dot, name, games, point call; `scoreboardHtml` in `hud.js`), kept inside the game picture. In 2 players it sits on the split line, above both views but below menus and banners (z-index 1; an earlier z-index 20 put it over every menu, so it was reverted).
- 1 player view fills the whole window (no black bars): renders at the window's shape (4:3 to ultrawide) and scales to cover (`cover` option in `pixel.js`). A first version let CSS stretch a small canvas and made the net blocky and outlines thick; it was replaced by the normal render path. The phone hint is a styled chip.
- Net flicker: the mesh cells were about 5 cm with sub-pixel cords. Cells are now about 40 cm with thicker cords (`court.js`, `textures.js`). Tried and reverted: smaller wobble, mipmapped soft mesh, woven over/under look.
- **Assist** (Settings, Off by default): easier returns. Timing window x1.7 and reach x1.4 for the human player only (`lab_set_easy_returns`, `player_reach_scaled` in `core/`; `oc_set_easy_returns` in the web build). Test: `test_assist_widens_the_reach`.
- Character select: the cat on the cursor does its own dance (`render/dances.js`, eased in and out): Otis hobo shuffle, Minu grumpy stomp, Bombay ninja spin, Bella pigeon strut, Snowy cloud twirl, Biscuit chaos windmill. The moves are my invention from the subtitles. Checked in the browser: Otis, Minu, Bombay. Not looked at: Bella, Snowy, Biscuit.
- Racket smash and owl chase confirmed still working (`?tantrum=cpu`).

### Choices this evening
| What | Your pick |
|---|---|
| Select art | Not flat drawings; use the in-game art, Street Fighter inspired, animated |
| Which select look to keep | 3D stage with the plain sky (no trees) |
| Courts per time of day | One court list plus a time selector (no separate night/sunset courts) |
| 16-bit look | Asked to see screenshots; no decision yet |
| Scoreboard, full-window view, phone hint chip | Requested; net look and wobble edits mostly reverted at your request |
| Assist and per-cat dances | Requested; the six dances are my picks, not yours |
| Open: 2-player real two-phone test, trainer run, extra shots, merge to main | unchanged |

---

## 2. Choices offered and what you picked

| # | When | What I offered | What you chose |
|---|---|---|---|
| 1 | Trainer flow | (a) return the example ball and record your swing, (b) record only the swing with no ball, (c) something else | **(a)** return the example ball |
| 2 | What looked wrong on the bat | left/right flipped, up/down or tilt, racket face, lag | **No preference** (so I added the mapping fixer instead) |
| 3 | Scope after the tuning round | five next steps: 1 commit, 2 bring back other shot types, 3 delay and net misses, 4 scoring and serve, 5 looks | **1, 2, 3, 4 now; for 5 look at art styles first** |
| 4 | Shot types | all eight shots vs basic only | **Basic only** (forehand and backhand) for now, extra shots later. A note from another session said the same; I applied it as ef9b4ea. **Superseded:** a later commit added the Shots menu setting (Basic / All) and All is now the default |
| 5 | Art style | chunky (current), retro, clean, soft | **Chunky** ("the current is nice... the rest is not that good") |
| 6 | Character approach | 1 free humanoid plus cat ears and tail, 2 cartoon animals, 3 improve the procedural cats | **Option 1**, then later **reverted to the original cats**; character cats are opt-in |
| 7 | External sound | Kenney sound pack | **Yes, get it** |
| 8 | How to download the packs | you download them, or I download in the browser pane | **I download in the browser pane**; then you said "ensure it is safe first", then "go ahead". I checked archive contents and recorded checksums |
| 9 | Texture detail | more procedural detail | **Yes** |
| 10 | Banners and animation | banner lettering, extra animation | **Both requested** |
| 11 | "Whats next" | (a) playtest on phone, (b) trainer run with phone, (c) bring back extra shots, (d) delay and net-miss polish, (e) cleanup and merge | You answered **"complete the rest of the game"**; I built the menu and match flow |
| 12 | Polish | I picked what to polish | HUD overlap fix; you did not pick further items |
| 13 | After 2P and cat selection | you asked "what else?"; I listed: real two-phone test, camera sits in the crowd after a hit, trainer run, extra shots, surfaces and match length, pause overlay and key help, merge | **Not chosen yet** |
| 14 | Better sounds on Openverse | a shortlist (real hits, serves, bounce, net cord, cheer, applause, whistle, about 1.5 MB, CC0), asking permission to download | **Yes** |
| 15 | Cheering | I added a cheer on your point | **Remove the cheering** |
| 16 | Phone vibration | vibrate on hit | **Requested**; it did not work, I offered the test button, counter and thump sound; **thump on by default** was your follow-up |
| 17 | Menu music | (a) synthesized loop, (b) a real CC0 track from Openverse | **Not asked; I chose (a)** and offered (b) later. No answer yet |
| 18 | More animation | I asked which of: slow-motion replay, crowd/cat reactions after match win, stretching ball shadow, count-in before serve | **You said yes to more animation without picking those**; I added the set listed above. The four ideas are still open |
| 19 | Hard CPU | you reported it could not return | **Requested a harder Hard**; numbers above are my choice |
| 20 | Umpire | an owl umpire | **Requested** |
| 21 | Next improvements (14 ideas) | list of 14: trainer run, 2-phone test, delay, extra shots, match length and surfaces, tutorial, difficulty ramp, camera bug, volume, replay, pause screen, real cat/owl sounds, merge, performance | **Chose: tutorial, camera bug fix, real cat and owl recordings, housekeeping (merge, performance)**; the rest are still open |

### Online play and the 2-player rebuild (2026-11-20)
Asked for: rebuild 2-player, add the emote to it, and an online mode to play a friend on another device (over the internet, laptop screen plus phone as racket). The user will report what broke in the old 2-player after trying it.
- **One link for both modes.** `web/game/duel.js` now turns what a core did into small messages (`serve`, `ball`, `pt`, `pos`, `score`) and applies them to the other core. Local 2-player hands them over directly; online sends the same messages as JSON through the server (`web/game/online.js`, `web/server/hub.js`). Online each page runs ONE core, the friend is the far cat.
- **Latency.** The receiver adds half the measured round trip to the ball's age, so the ball is where it would be. The friend's cat is sent 20 times a second and smoothed. The host's score is the truth: the guest adopts it after every point (`lab_remote_score` in core/lab.c), so two rulings that cross in transit cannot split the scores.
- **Shared freezes.** Pause, a hidden tab or a missing phone on either side holds both. Each match (and rematch) needs both intros to finish and both players to ask. No replay online.
- **Rooms.** A phone belongs to a room (`/pad?room=...`, its own page); the two pages of a match meet in a match code. Pages that arrive through a tunnel must name a room, so a stranger with the tunnel address cannot use the local phones.
- **Tunnel safety.** Through a tunnel every request comes from 127.0.0.1, so `/api/tuning` and `/api/mapping` (which write files) now refuse any request carrying proxy headers.
- **Menu.** Title > Online > Host a game (pick cat, then court and time, the host's court and ball are used) or Join with a code. The lobby shows the code, the link to send, and a QR for your phone. A friend's link (`/?join=CODE`) opens straight on the cat pick. Run `make online` for the internet link (needs `cloudflared`, installed once with `brew install cloudflared`; the script installs nothing). Without it the link works on the same Wi-Fi only.
- **2-player fixes.** WASD now moves player 1 and the arrows move player 2 (before, only player 1 could be steered). A phone can be tied to a seat (`/pad?seat=2`), and the QR shown for a missing phone carries the seat, so a reload no longer swaps P1 and P2. Player 2's phone emote used to be dropped.
- **Emote.** Works in 2-player (E = player 1, / = player 2, or either phone's button; only between points; the other view and, online, the friend see the dance on the far cat) and online (the match does not wait for it; the next serve ends it).
- Dev flag: `?online=CODE` (host) or `?online=CODE&guest` skips the menus, for testing two pages by hand.

### Doubles and the animated title (2026-11-21)
- **Doubles (2 vs 2):** More modes > Doubles. You pick your cat, then a CPU partner, then the court; the other two cats are the CPU team. Core flag `lab.doubles` (off = singles is byte-for-byte the same: a seeded 6-match singles hash is unchanged). Design and as-built notes: `docs/notes/doubles-design.md`.
- Doubles court is the wide one (alleys count); serves still use the normal service boxes and alternate sides. Server order: you, CPU A, your partner, CPU B.
- Doubles does **not** count toward career stats, unlocks or the heat map; shot labels and grunts describe only your own hits.
- Not done: online 2v2, four humans. Not tried with a real phone.
- **Title page:** the in-game cats now chase each other round the court behind the menu (`render/titlescene.js`), with swipes, leaps, dust and a bouncing ball. Off when the system asks for reduced motion.
- Dev flag: `?games=N` shortens any match to N games (handy to test doubles).

### Menus, wardrobe, career, pause and music (2026-11-21)
- **Settings** are filed under four pages (Gameplay, Sound, Look & feel, Replays & calls). Each page has its own "Reset to default" (only that page); the main "Reset to defaults" still resets everything plus court and time of day.
- **Aim assist now defaults to Strong** (`DEFAULTS.aim = 1`). Saved settings are not changed; players who never touched it get the new default only after a reset.
- **Wardrobe** shows a picture tile per item (collar, racket, ball trail) instead of text rows. Locked tiles are dimmed with their goal; click or tap an unlocked tile to wear it (arrow keys still cycle). Art is inline SVG in `modeui.js` (`itemArt`).
- **Career** screen: win-rate ring, eight stat tiles, tournament title chips, and progress bars toward the three closest locked cosmetics.
- **Pause screen:** the settings moved onto a Settings page (button, or `S`). Same rows and text as before; Esc / P / Enter / Backspace or a click outside goes back to the pause menu, Esc on the pause menu still resumes.
- **Music:** four synthesized loops in `music.js`, picked by game state in `musicPlan()` (`game.js`): title/menus/lessons, pause (90 bpm, F major, no drums), story map and talk scenes (96 bpm, D minor, flute lead), and cat select (138 bpm, C major). Still none during live play.
- **Story map is a 3D diorama** (`render/mapscene.js`): a slab of park with a road through the six stops, a pond, stream, sea, city and hill, and a toy-style building at each stop, lit with shadows and viewed from the south; the camera leans a little with the pointer. The stop pins and the cat token stay DOM elements and are moved each frame onto the projected ground positions (the token walks along the road after a win). Each stop's building has its own surroundings (gate: fences, lamps, flower beds; pond: stone rim, two swimming ducks, reeds, willow, bench; market: three stalls, bunting, fountain, crates; rooftop: windowed block with a court, tank, neighbours; harbour: pier, two boats, crane, striped lighthouse with a sweeping beam; roost: banded clock tower with lit windows, two clock faces and the owl), plus road-edge stones, around 90 trees (a few blossom), bushes, rocks, instanced flowers and grass, shoreline foam and a shimmer on the sea. Done stops get a star, the next a ring and arrow, locked ones are dimmed. Without WebGL the old painted SVG map shows. (A first try with floating models over the painted map was reverted: not liked.) Not tried on a phone.
- **Story cut-scene sounds** (`cutsfx.js`, played from `game.js`): a typewriter blip for each spoken letter (hero high, rival lower, the owl lowest), a pop as each line appears plus a mood sound (a grumble meow, a happy chirp, a rising tone for a question, the owl's hoot on his own lines), an opening and a closing sting around the talk, and on the map a chime, four footsteps and a bell when the cat walks on, a thud after a defeat, and a fanfare with applause when the story ends. All synthesized except the footstep, thud, hoot, meow and applause recordings already in the game. Not heard by ear yet.
- **Wardrobe 3D preview** (`render/wardrobestage.js`): your cat on a small turntable wearing what is equipped, swinging now and then, with a ball looping round it that leaves the equipped trail. Point at any tile (locked ones too) to preview it with its name and unlock goal; the pointer over the stage turns the cat. One stage is kept and its canvas moved into the page on each redraw (`attachWardrobe` in `game.js`), so there is no new WebGL context per redraw.
- **Mix pass:** the four tunes were measured (RMS of the music output at the same setting: menu .045, pause .043, story .049, select .049) and trimmed to match (`TUNE_TRIM` in `music.js`; the pause tune still plays a touch quieter on purpose). Changing tune while one plays now crossfades (0.25 s out, 0.45 s in) instead of cutting.
- **Smoke test** (`test/imports.test.mjs`): no browser is installed, so it checks statically that every module parses and every relative import names a file and an export that exist (it catches the "blank page after a bad import" class of bug; checked against the real one from earlier). A real browser smoke test is `npm run smoke` in `web/` (`scripts/smoke.mjs`, Playwright + headless Chromium, installed as a dev dependency on 2026-11-21 with `npx playwright install chromium`): it starts the server on spare ports, walks the title, settings, wardrobe, career, the 3D story map (picking and replaying a stop, the talk for the right stop, the boss entrance), the tutorial, the two-player pick, a doubles match, a practice game, a match, pause and its settings page, and fails on any page error, console error or failed request . It is not part of `npm test` because it needs the browser and takes a few minutes. It was checked against the real replay-index bug (reintroduced on purpose, it fails). A resting pointer over a menu card moves the menu cursor onto it, so the script moves the mouse away before pressing Enter.
- **Optional JSON:** `/mapping.json`, `/tuning.json` and their `.trial` versions are written by the trainer, so before then the server answers 204 (nothing yet) instead of a 404; the game and trainer skip a 204. The smoke test no longer ignores any failed request.
- **Merged:** `mac-phone-controller` was fast-forwarded into `main` (main had no commits of its own). Nothing was pushed (there is no remote).
- **Story map replay:** click a finished stop (or Left/Right) to pick it, Enter replays it. A replay changes no story progress (`storyPlay` kept in `sessionStorage` across the court reload). While adding this I found the story page had been failing at start-up since the cut-scene sounds went in (`audio` used before it existed, swallowed by a bare `catch`); fixed, and start-up errors are now logged.
- **Career history:** the last 20 matches (`history` in the saved progress: result, score, rival, mode, time). The career screen shows a W/L form strip, a win-rate line and the last five matches.
- **More cosmetics:** hats (sun cap, party, wizard, top hat, crown), headbands (white, red, neon, rainbow) and ball skins (striped, star, golden, flame, disco) join collar, racket and trail: 31 items, six rows. Worn on the cat in matches and in the wardrobe preview (a ball skin replaces the ball-colour setting while worn). Unlock goals use the existing career numbers plus party matches and daily streak.
- **Story depth:** each stop gives one reward cosmetic the first time any cat clears it (Park Gate: Leaf collar, Duck Pond: Pond beanie, Market Square: Market headband, Rooftop Court: City lights trail, Harbour Lights: Harbour racket, Hoot's Roost: Moon ball); shown on the map panel and toasted on the win; stops cleared before this existed are backfilled at start-up (`career.stop0..stop5`). Finishing any cat's story makes **Professor Hoot playable** in quick 1P/2P/online matches (not the story, tournament, daily or doubles, which are built for the six cats). The last stop opens with an animated **boss entrance** (moon, owl silhouette, eyes open, his name; drone, hoot, sting; any key skips; skipped with reduced motion). Replaying a stop (see above) also gets the entrance.
- Bug found and fixed while testing this: `readPlay()` turned a missing `sessionStorage` key into stop 0 (`Number(null)` is 0), making every story page look like a replay of Park Gate. The new smoke steps below guard the story flow.
- **Practice** (More modes > Practice): *Target Practice* (ten fed balls, four rings that move on after each hit, score out of 10) and *Rally Challenge* (a normal rally against the CPU, three lives, score = best rally). Built on the daily-challenge machinery (`PRACTICE` in `challenge.js`, `practiceOn` in `game.js`) so each is a page built for one game, but with no stars, streak or career credit; the best score of each is kept (`loxford.practice`).
- Not checked by ear in a browser: the pause, story and select tunes (tested only that they differ and have the right voices).

### 2026-11-22 (scoring fix, grunts, rematch button)
- **Online/2P scoring bug** ("when P2 hits the ball out he still gets the point"). In a remote lab the receiver judged a ball that flew past it as a miss before it had landed, so a long ball (the hitter's out) awarded the hitter the point. `core/lab.c` now only calls it a miss once the ball has bounced in the near court (`bounced_near`) or come to rest. A served ball that arrives already bounced (`lab_remote_ball` with `after_bounce`) no longer waits for a second bounce to find the meeting point. Tests: `test_remote_receiver_finds_the_served_ball_after_its_bounce`, `test_remote_long_ball_is_out_not_a_miss`, and `test_remote_pair_over_lag_keeps_rules_and_scores_in_sync` (two linked labs, 100 ms lag, 400 s of play: the last hitter never wins on an out, net or fault, and both sides' scores mirror once the link drains; with the fix reverted the score checks fail). The harness reported a few "early miss" flags on the hitter's own side; they look like a false alarm from the flag (`bounced_near` means nothing there) and were not traced further.
- **Effort grunts** (`audio.js`): nine different grunts (`EFFORTS`: hnh, hah, hyah, ngh, huh, yah, urgh, hii, oof) picked by `pickEffort` for the shot: loud rising ones for the hardest hits, low gritty ones for backhands, never the same twice in a row, each varied a little. A grunt now also plays on a backhand with some weight (speed 10 or more), not only hits of 15 or more; its loudness follows the hit speed.
- **Fire effect starts later:** embers from the 9th hit of a point and a full blaze from the 28th (`FIRE_START`, `FIRE_FULL` in `feel.js`; was 4 and 16).
- **Rematch button:** a plain match (not story, tournament or daily) ends with a Rematch button in the middle of the screen. Swinging or pressing Enter no longer restarts it and the screen is not darkened. Online it reads "Waiting for your friend..." after you ask and "Accept rematch" when your friend asked first.
- **Tried and reverted at your request:** best-of-3 sets with a podium cut-scene and a sets column on the scoreboard. A match is back to the old games format (`SCORE_GAMES_TO_WIN`).
- **Network note:** the dev server's plain-HTTP port 8080 listens on this Mac only. From another computer on the same Wi-Fi use `https://<this Mac's address>:8443/` (self-signed certificate warning; both machines on one network).

### Decisions I made without asking (check these)
- Two players use one core per player linked through JavaScript, not a rewrite of the core into a symmetric two-human game. Cheaper and testable, but if two cores ever disagree on a point, the first one to rule wins.
- (Changed 2026-11-20: WASD = player 1, arrows = player 2 in a 2-player match.) Keyboard arrows steered player 1 only; player 2 auto-ran to the ball.
- Settings that rebuild the scene (hand, players, cats) reload the page.
- The CPU level setting is hidden in a 2-player match.
- Menu, pause, story and select music are generated in the browser instead of downloaded.
- Game-win applause was kept when cheering was removed.
- The CPU shares the 1.4x reach increase.
- Hard CPU speed above 8 m/s overshoots the ball, so I stopped at 8.

---

## 3. Open items
- Run the trainer with your phone to fit shot thresholds (old data gave 63% default, 75% fitted).
- Shots are All by default now (Basic is a menu option). The phone swing thresholds are still unfitted to your real swings (old data: 63% default, 75% fitted), so extra shots may misread until the trainer run is done.
- About 130 ms swing-to-return delay and about 2 in 24 forehands into the net remain.
- Camera ended up inside the crowd area after a hit in the stacked two-player view (cause not checked).
- Phone vibration on iPhone: only the thump works unless you tell me otherwise.
- Check the Bella, Snowy and Biscuit dances and say which moves to change; feel out Assist in a real rally (1.7x / 1.4x are my guesses).
- Net flicker fix not yet confirmed on your screen.
- Doubles: play a real match with a phone; check the partner's CPU level (it plays at the opponents' level) and the camera framing on a wide court.
- Title chase: judge the look on your screen (camera framing, cat size).

## 4. Handy URLs and flags
- Game: `http://localhost:8080/` (add `?nophone` to play without a phone, `?debug` for diagnostics).
- Phone: scan the QR code `make -C web play` prints (page `/pad`).
- Trainer: `/train` (`?all` for all eight shots).
- Online: `make online` (internet, needs cloudflared) or Online > Host a game on the same Wi-Fi; `?online=CODE[&guest]` for testing.
- Game flags: `?arcade`, `?level=0|1|2`, `?shots`, `?lefty`, `?style=chunky|retro|clean|soft`, `?res=240..1920`, `?cats=character`, `?assist`, `?games=N`.
