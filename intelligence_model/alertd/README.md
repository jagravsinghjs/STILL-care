# alertd — real-time alert relay

A pure message relay, not a database watcher. It has no SQLite
dependency and never touches `alerts` directly — it exists purely to
turn Module 16's individual pushes into a live broadcast fan-out, so a
connected dashboard doesn't have to poll `api/routes_alerts.py` every few
seconds.

## Two sockets, two roles

- **Publish socket** (`STILL_ALERTD_SOCKET_PATH`, default
  `/tmp/still_alertd.sock`) — `modules/module6_alerting/notifier.py`
  connects here after every `Alert` insert: connect, send one JSON
  payload, close. alertd reads until that connection closes (EOF), then
  relays exactly those bytes to every subscriber.
- **Subscribe socket** (`STILL_ALERTD_SUBSCRIBE_SOCKET_PATH`, default
  `/tmp/still_alertd_subscribe.sock`) — a dashboard/frontend relay
  connects here and stays connected. alertd only ever *writes* to these
  connections; it never reads from them. Each broadcast is newline-
  terminated, so a subscriber receiving several alerts in quick
  succession can split on `\n` to recover individual JSON messages.

## What this daemon does NOT guarantee

**No persistence, no replay, no queue.** If alertd isn't running (or a
subscriber isn't connected) at the moment `notifier.py` pushes, that
push is simply lost from alertd's perspective — it will never be
re-delivered. This is fine, and by design: the `alerts` table (written
by `alert_engine.py` *before* `notifier.py` is ever called) is the
actual durable source of truth. A missed live push just means the
dashboard finds out on its next `GET /alerts` poll instead of instantly.
Nothing about correctness depends on alertd being up.

## Build

Via the top-level CMake build (recommended — this is how it's wired into
the rest of the project):
```bash
cmake -S . -B build -DSTILL_BUILD_ALERTD=ON
cmake --build build
```
Produces a `alertd` binary in `build/`.

Standalone (for iterating on alertd alone without rebuilding
`still_core`):
```bash
cd alertd
gcc -Wall -Wextra -pthread -o alertd alertd.c socket_server.c
```
No `-lsqlite3` needed — this daemon has no SQLite dependency (see the
CMakeLists.txt note below).

## Run

```bash
./alertd
# or, to override socket paths:
STILL_ALERTD_SOCKET_PATH=/custom/publish.sock \
STILL_ALERTD_SUBSCRIBE_SOCKET_PATH=/custom/subscribe.sock \
./alertd
```
Stops cleanly on `Ctrl+C` or `SIGTERM` — closes every connection,
removes both socket files.

## A CMakeLists.txt cleanup this build enables

`alertd`'s target in the root `CMakeLists.txt` currently has
`find_package(SQLite3 REQUIRED)` and links `${SQLite3_LIBRARIES}`. That
dependency is no longer needed — this version of alertd never opens the
database. Those two lines (the `find_package(SQLite3 REQUIRED)` call and
`SQLite3_LIBRARIES` in `target_link_libraries`) can be removed from the
`STILL_BUILD_ALERTD` block; `Threads::Threads` is still required (this
daemon is genuinely multi-threaded — one thread per socket's accept
loop).