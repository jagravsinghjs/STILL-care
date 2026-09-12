#include "socket_server.h"
#include "config.h"

#include <errno.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

static int publish_fd = -1;
static int subscribe_fd = -1;
static int subscriber_fds[MAX_SUBSCRIBERS];
static int subscriber_count = 0;
static pthread_mutex_t subscriber_lock = PTHREAD_MUTEX_INITIALIZER;

static pthread_t publish_thread;
static pthread_t subscribe_thread;
static volatile int running = 0;

static int make_listening_socket(const char *path) {
    unlink(path); /* remove a stale socket file from a previous unclean shutdown */

    int fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (fd < 0) {
        perror("socket_server: socket()");
        return -1;
    }

    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, path, sizeof(addr.sun_path) - 1);

    if (bind(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("socket_server: bind()");
        close(fd);
        return -1;
    }
    if (listen(fd, MAX_SUBSCRIBERS) < 0) {
        perror("socket_server: listen()");
        close(fd);
        return -1;
    }
    return fd;
}

static void add_subscriber(int fd) {
    pthread_mutex_lock(&subscriber_lock);
    if (subscriber_count < MAX_SUBSCRIBERS) {
        subscriber_fds[subscriber_count++] = fd;
    } else {
        fprintf(stderr, "socket_server: MAX_SUBSCRIBERS (%d) reached, dropping new connection\n",
                MAX_SUBSCRIBERS);
        close(fd);
    }
    pthread_mutex_unlock(&subscriber_lock);
}

void broadcast(const char *message, size_t length) {
    /* Build message + delimiter once, write the same bytes to every
     * subscriber rather than re-formatting per recipient. */
    char framed[MAX_MESSAGE_SIZE + 1];
    if (length >= sizeof(framed) - 1) {
        length = sizeof(framed) - 2; /* truncate defensively rather than overflow */
    }
    memcpy(framed, message, length);
    framed[length] = '\n';
    size_t framed_len = length + 1;

    pthread_mutex_lock(&subscriber_lock);
    int write_idx = 0;
    for (int i = 0; i < subscriber_count; i++) {
        int fd = subscriber_fds[i];
        ssize_t sent = write(fd, framed, framed_len);
        if (sent == (ssize_t)framed_len) {
            subscriber_fds[write_idx++] = fd; /* still alive -- keep it */
        } else {
            /* Broken pipe / connection reset -- subscriber disconnected.
             * This is the only place dead subscribers get noticed, since
             * we never read() from them. */
            close(fd);
        }
    }
    subscriber_count = write_idx;
    pthread_mutex_unlock(&subscriber_lock);
}

static void *subscribe_accept_loop(void *arg) {
    (void)arg;
    while (running) {
        int client_fd = accept(subscribe_fd, NULL, NULL);
        if (client_fd < 0) {
            if (!running) break; /* accept() unblocked by stop_server()'s shutdown()+close() */
            perror("socket_server: accept() on subscribe socket");
            continue;
        }
        add_subscriber(client_fd);
    }
    return NULL;
}

static void *publish_accept_loop(void *arg) {
    (void)arg;
    while (running) {
        int client_fd = accept(publish_fd, NULL, NULL);
        if (client_fd < 0) {
            if (!running) break;
            perror("socket_server: accept() on publish socket");
            continue;
        }

        /* Read until the peer closes (EOF) -- notifier.py's sendall()
         * followed by its `with` block exiting guarantees a clean close
         * right after the payload is sent, so EOF is a reliable "message
         * complete" signal here. */
        char buffer[MAX_MESSAGE_SIZE];
        size_t total = 0;
        ssize_t n;
        while (total < sizeof(buffer) &&
               (n = read(client_fd, buffer + total, sizeof(buffer) - total)) > 0) {
            total += (size_t)n;
        }
        close(client_fd);

        if (total > 0) {
            broadcast(buffer, total);
        }
        /* total == 0 (publisher connected and closed without sending
         * anything) is silently ignored -- not an error, just nothing to
         * relay. */
    }
    return NULL;
}

int start_server(const char *publish_socket_path, const char *subscribe_socket_path) {
    publish_fd = make_listening_socket(publish_socket_path);
    if (publish_fd < 0) return -1;

    subscribe_fd = make_listening_socket(subscribe_socket_path);
    if (subscribe_fd < 0) {
        close(publish_fd);
        return -1;
    }

    running = 1;

    if (pthread_create(&publish_thread, NULL, publish_accept_loop, NULL) != 0) {
        perror("socket_server: pthread_create (publish)");
        running = 0;
        return -1;
    }
    if (pthread_create(&subscribe_thread, NULL, subscribe_accept_loop, NULL) != 0) {
        perror("socket_server: pthread_create (subscribe)");
        running = 0;
        pthread_join(publish_thread, NULL);
        return -1;
    }

    return 0;
}

void stop_server(void) {
    running = 0;

    /* shutdown() unblocks a thread currently sitting in accept() on this
     * fd; close() alone does not reliably do that on Linux. */
    if (publish_fd >= 0) {
        shutdown(publish_fd, SHUT_RDWR);
        close(publish_fd);
    }
    if (subscribe_fd >= 0) {
        shutdown(subscribe_fd, SHUT_RDWR);
        close(subscribe_fd);
    }

    pthread_join(publish_thread, NULL);
    pthread_join(subscribe_thread, NULL);

    pthread_mutex_lock(&subscriber_lock);
    for (int i = 0; i < subscriber_count; i++) {
        close(subscriber_fds[i]);
    }
    subscriber_count = 0;
    pthread_mutex_unlock(&subscriber_lock);

    unlink(config_publish_socket_path());
    unlink(config_subscribe_socket_path());
}