/*
 * alertd/alertd.c
 *
 * Entry point. alertd is a pure relay -- it has NO database access
 * (see socket_server.c's header comment for why). Opens both sockets,
 * then blocks in sigwait() for SIGINT/SIGTERM.
 *
 * Signal handling note: SIGINT/SIGTERM are explicitly BLOCKED in this
 * thread's mask before start_server() creates the accept-loop threads.
 * pthread_create() has new threads inherit the creating thread's signal
 * mask, so this guarantees every thread in the process has these two
 * signals blocked -- meaning the kernel can only ever deliver them to
 * whichever thread is actively sigwait()-ing on them (main, below), not
 * to an accept-loop thread that happens to be scheduled at the wrong
 * moment. A plain signal()+pause() approach (the previous version of
 * this file) doesn't have that guarantee: an async signal can land on
 * ANY thread that doesn't have it blocked, and in a multithreaded
 * process that's whichever thread the kernel picks -- not necessarily
 * main. That's what caused this daemon to need two Ctrl+C presses to
 * actually shut down. sigwait() with a pre-blocked mask is the standard,
 * portable fix.
 */

#include "config.h"
#include "socket_server.h"

#include <pthread.h>
#include <signal.h>
#include <stdio.h>

int main(void) {
    const char *publish_path = config_publish_socket_path();
    const char *subscribe_path = config_subscribe_socket_path();

    /* Block SIGINT/SIGTERM in THIS thread before any other thread is
     * created -- pthread_create() below inherits this mask, so every
     * accept-loop thread will also have these blocked. */
    sigset_t mask;
    sigemptyset(&mask);
    sigaddset(&mask, SIGINT);
    sigaddset(&mask, SIGTERM);
    if (pthread_sigmask(SIG_BLOCK, &mask, NULL) != 0) {
        perror("alertd: pthread_sigmask");
        return 1;
    }

    fprintf(stderr, "alertd: publish socket  = %s\n", publish_path);
    fprintf(stderr, "alertd: subscribe socket = %s\n", subscribe_path);

    if (start_server(publish_path, subscribe_path) != 0) {
        fprintf(stderr, "alertd: failed to start -- exiting\n");
        return 1;
    }

    fprintf(stderr, "alertd: running (Ctrl+C or SIGTERM to stop)\n");

    /* Synchronously wait for SIGINT or SIGTERM -- guaranteed to be THIS
     * thread that receives it, since it's the only thread with these
     * signals unblocked at the point of the sigwait() call itself
     * (sigwait() temporarily unblocks the specified signals for the
     * calling thread while waiting). */
    int caught_signal;
    sigwait(&mask, &caught_signal);

    fprintf(stderr, "alertd: shutting down\n");
    stop_server();
    return 0;
}