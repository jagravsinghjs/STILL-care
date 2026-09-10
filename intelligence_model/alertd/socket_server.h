/*
 * alertd/socket_server.h
 *
 * Public interface for the dual-socket relay: one publish endpoint
 * (short-lived producer connections), one subscribe endpoint (long-lived
 * consumer connections). Declared separately from alertd.c so the
 * transport layer can change (e.g. TCP instead of Unix sockets) without
 * touching alertd.c's lifecycle/signal-handling logic.
 */

#ifndef STILL_ALERTD_SOCKET_SERVER_H
#define STILL_ALERTD_SOCKET_SERVER_H

#include <stddef.h>

/* Starts both accept loops (each in its own thread). Returns 0 on
 * success, -1 on failure (check errno / stderr for details). */
int start_server(const char *publish_socket_path, const char *subscribe_socket_path);

/* Relays `message` (length bytes, NOT null-terminated required) to every
 * currently-connected subscriber, appending a newline as a message
 * delimiter (subscribers may receive several broadcasts concatenated in
 * one read() -- newline-delimited JSON lets them split correctly).
 * Dead subscriber connections are pruned lazily on write failure. */
void broadcast(const char *message, size_t length);

/* Unblocks both accept() calls, joins both threads, closes every
 * subscriber fd, and unlinks both socket files. Safe to call once at
 * shutdown; not safe to call broadcast() after this returns. */
void stop_server(void);

#endif /* STILL_ALERTD_SOCKET_SERVER_H */