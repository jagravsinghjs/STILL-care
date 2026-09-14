/*
 * alertd/config.h
 *
 * Compile-time defaults + runtime env-var overrides for everything
 * ops-tunable. Env vars take precedence when set, so this daemon's
 * socket paths can be kept in sync with the Python side's STILL_ALERTD_
 * SOCKET_PATH without editing and recompiling C on every deployment.
 */

#ifndef STILL_ALERTD_CONFIG_H
#define STILL_ALERTD_CONFIG_H

#include <stdlib.h>

/* Publish socket: notifier.py (Module 16) connects here, sends one JSON
 * message, closes. Matches notifier.py's own default exactly -- keep
 * these in sync if either side's default ever changes. */
#define DEFAULT_PUBLISH_SOCKET_PATH "/tmp/still_alertd.sock"

/* Subscribe socket: dashboard/frontend relay clients connect here and
 * stay connected. alertd only ever WRITES to these -- never reads. */
#define DEFAULT_SUBSCRIBE_SOCKET_PATH "/tmp/still_alertd_subscribe.sock"

#define MAX_SUBSCRIBERS 32
#define MAX_MESSAGE_SIZE 4096  /* bytes; a single alert's JSON payload is tiny by comparison */

static inline const char *config_publish_socket_path(void) {
    const char *env = getenv("STILL_ALERTD_SOCKET_PATH");
    return (env != NULL) ? env : DEFAULT_PUBLISH_SOCKET_PATH;
}

static inline const char *config_subscribe_socket_path(void) {
    const char *env = getenv("STILL_ALERTD_SUBSCRIBE_SOCKET_PATH");
    return (env != NULL) ? env : DEFAULT_SUBSCRIBE_SOCKET_PATH;
}

#endif /* STILL_ALERTD_CONFIG_H */