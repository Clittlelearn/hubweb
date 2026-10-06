#!/usr/bin/env python3
"""Authenticated loopback tunnels for the Hub stack hosted on 192.168.1.110."""
import argparse
import importlib.util
from pathlib import Path
import select
import signal
import socketserver
import threading
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frontend-only', action='store_true')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('deploy110', Path(__file__).with_name('deploy-110.py'))
    deploy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(deploy)
    client = deploy.connect()
    transport = client.get_transport()
    transport.set_keepalive(15)
    servers = []
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    def handler_for(remote_port):
        class Handler(socketserver.BaseRequestHandler):
            def handle(self):
                channel = None
                try:
                    channel = transport.open_channel('direct-tcpip', ('127.0.0.1', remote_port), self.client_address)
                    while not stop.is_set():
                        readers, _, _ = select.select([self.request, channel], [], [], 1)
                        for source in readers:
                            data = source.recv(65536)
                            if not data:
                                return
                            (channel if source is self.request else self.request).sendall(data)
                except (OSError, EOFError):
                    pass
                finally:
                    if channel:
                        channel.close()
        return Handler

    try:
        mappings = [(25174, 5174)]
        if not args.frontend_only:
            mappings += [(8545, 8545), (8546, 8546)]
        for local, remote in mappings:
            server = Server(('127.0.0.1', local), handler_for(remote))
            servers.append(server)
        for server in servers:
            threading.Thread(target=server.serve_forever, daemon=True).start()
        print('Hub on 110: http://localhost:25174/bridge', flush=True)
        print('Frontend-only tunnel.' if args.frontend_only else 'BSC/EVM RPCs forwarded on 8546/8545.', flush=True)
        while not stop.wait(1):
            if not transport.is_active():
                raise RuntimeError('SSH connection lost; restart this launcher to reconnect.')
    finally:
        for server in servers:
            server.server_close()
        client.close()


if __name__ == '__main__':
    main()
