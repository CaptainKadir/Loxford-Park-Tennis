# Loxford Park Tennis
#   make test    build and run the physics tests on this Mac
#   make tools   build tools/replay_swing (prints what a recorded swing would be called)
#   make -C web play    run the game (see README)
#   tools/macapp/build.sh    build the Mac app
# Uses only relative paths, because this project folder has spaces in its name.

CORE_SRC := $(wildcard core/*.c)
TEST_SRC := $(wildcard tests/*.c)

.PHONY: test tools clean

# ---------------------------------------------------------------- host tests
HOST_CC     ?= cc
HOST_CFLAGS := -std=c99 -O2 -Wall -Wextra -Werror -Icore

build/host/tests: $(CORE_SRC) $(TEST_SRC) $(wildcard core/*.h) tests/test.h
	@mkdir -p build/host
	$(HOST_CC) $(HOST_CFLAGS) $(CORE_SRC) $(TEST_SRC) -lm -o $@

test: build/host/tests
	./build/host/tests

tools: build/host/replay_swing

build/host/replay_swing: tools/replay_swing.c $(CORE_SRC) $(wildcard core/*.h)
	@mkdir -p build/host
	$(HOST_CC) $(HOST_CFLAGS) $(CORE_SRC) tools/replay_swing.c -lm -o $@

clean:
	rm -rf build dist
