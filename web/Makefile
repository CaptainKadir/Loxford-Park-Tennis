# make -C web wasm | test | play (server added in Task 4)
CORE_SRC := $(filter-out ../core/samplecsv.c,$(wildcard ../core/*.c))
CORE_HDR := $(wildcard ../core/*.h)
EXPORTS  := _oc_init,_oc_step,_oc_phone_sample,_oc_phone_reset,_oc_state,_oc_state_len,_oc_set_shot_tuning,_oc_set_basic_shots,_oc_set_easy_returns,_oc_set_strong_aim,_oc_classify_shot,_oc_demo_prepare,_oc_force_stroke,_oc_demo_swing,_oc_init_remote,_oc_init_doubles,_oc_remote_ball,_oc_remote_point,_oc_remote_serve,_oc_remote_pos,_oc_remote_score,_oc_set_tutorial,_oc_set_match_games

.PHONY: wasm test
wasm: build/core.js

build/core.js: $(CORE_SRC) $(CORE_HDR) wasm_api.c
	@mkdir -p build
	emcc -O2 -std=c99 -I../core $(CORE_SRC) wasm_api.c -o build/core.js \
	  -sMODULARIZE -sEXPORT_ES6 -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH \
	  -sEXPORTED_FUNCTIONS=$(EXPORTS) -sEXPORTED_RUNTIME_METHODS=HEAPF32 -lm

test: wasm
	node --test test/*.test.mjs

.PHONY: certs server play online
certs:
	sh scripts/make-cert.sh
server:
	node server/index.js
# Play a friend over the internet: the same server behind a Cloudflare tunnel (needs cloudflared, see scripts/online.sh)
online: wasm
	sh scripts/online.sh
play: wasm
	@test -f certs/key.pem || sh scripts/make-cert.sh
	node server/index.js
