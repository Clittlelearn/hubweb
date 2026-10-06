#!/usr/bin/env python3
"""Stage the existing Hub stack on 110 without stopping chains or copying live DBs."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

import paramiko

HOST = '192.168.1.110'
ROOT = '/srv/hivex-hub'
HOME = Path('/home/wbl')
CACHE = HOME / '.cache/hivex-hub-deploy110'
FRONTEND = HOME / 'hubfrontend'
SQL = HOME / 'hubsql'


def connect():
    sys.path.insert(0, str(HOME / 'hivex/scripts/testnet'))
    from restart_testnet import load_credentials
    credentials = load_credentials(str(HOME / '.config/hivex/testnet-credentials.json'))
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    # Pin the first observed host key in a private deployment-specific known_hosts.
    known = CACHE / 'known_hosts'
    if known.exists():
        client.load_host_keys(str(known))
    class PinHost(paramiko.MissingHostKeyPolicy):
        def missing_host_key(self, client, hostname, key):
            client.get_host_keys().add(hostname, key.get_name(), key)
            client.save_host_keys(str(known))
            known.chmod(0o600)
            print('Pinned SSH host key:', key.get_name(), hashlib.sha256(key.asbytes()).hexdigest())
    client.set_missing_host_key_policy(PinHost())
    client.connect(HOST, username='root', password=credentials['root_password'], timeout=15)
    return client


def remote(client, command):
    _, stdout, stderr = client.exec_command(command)
    output = stdout.read().decode()
    error = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    if output:
        print(output, end='', flush=True)
    if code:
        raise RuntimeError(f'Remote command failed ({code}): {error[:2000]}')
    return output


def bundle_binary(target, source):
    target.mkdir(parents=True, exist_ok=True)
    lib = target / 'lib'
    lib.mkdir(exist_ok=True)
    binary = target / source.name
    shutil.copy2(source, binary)
    subprocess.run(['strip', '--strip-debug', str(binary)], check=True)
    dependencies = subprocess.check_output(['ldd', str(source)], text=True)
    for line in dependencies.splitlines():
        parts = line.split()
        candidate = parts[2] if len(parts) > 2 and parts[1] == '=>' else parts[0] if parts else ''
        if candidate.startswith('/'):
            resolved = Path(candidate)
            shutil.copy2(resolved.resolve(), lib / resolved.name)


def prepare():
    bundle = CACHE / 'bundle'
    bundle.mkdir(parents=True, exist_ok=True)
    bundle_binary(bundle / 'node', Path('/usr/bin/node'))
    bundle_binary(bundle / 'hubsql', SQL / 'build/src/hubsql')
    mysql = SQL / 'deploy/mysql-portable'
    for name in ['mysqld', 'mysql', 'mysqladmin', 'mysqldump']:
        bundle_binary(bundle / 'mysql', mysql / 'bin' / name)
    archive = CACHE / 'application.tar.gz'
    exclusions = {'.git', '.env', '.env.local', '.env.production', 'test-results', 'playwright-report'}
    def include(info):
        if exclusions.intersection(Path(info.name).parts):
            return None
        if info.name == 'frontend/tools/bridge-lab/runtime' or info.name.startswith('frontend/tools/bridge-lab/runtime/'):
            return None
        info.uid = info.gid = 0
        info.uname = info.gname = 'root'
        return info
    with tarfile.open(archive, 'w:gz', compresslevel=3) as tar:
        tar.add(bundle, arcname='runtime-bin')
        tar.add(mysql / 'share', arcname='mysql/share')
        tar.add(SQL / 'sql', arcname='hubsql/sql')
        for name in ['src', 'public', 'packages', 'node_modules', 'tools', 'index.html', 'package.json',
                     'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.node.json']:
            source = FRONTEND / name
            if source.exists():
                tar.add(source, arcname=f'frontend/{name}', filter=include)
    archive.chmod(0o600)
    print('Prepared application archive:', archive.stat().st_size, 'bytes (no chain DBs or identities).')


def stage(client):
    archive = CACHE / 'application.tar.gz'
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    remote(client, f'install -d -m 750 {ROOT}')
    with client.open_sftp() as sftp:
        sftp.put(str(archive), f'{ROOT}/application.tar.gz.upload')
        sftp.chmod(f'{ROOT}/application.tar.gz.upload', 0o600)
    received = remote(client, f'sha256sum {ROOT}/application.tar.gz.upload').split()[0]
    if received != digest:
        raise RuntimeError('Archive checksum mismatch')
    # A separate staging directory cannot overwrite an existing deployment or its data.
    remote(client, f'mkdir {ROOT}/staged')
    remote(client, f'tar -xzf {ROOT}/application.tar.gz.upload -C {ROOT}/staged')
    for name, binary in [('node', 'node'), ('hubsql', 'hubsql'), ('mysql', 'mysqld')]:
        folder = f'{ROOT}/staged/runtime-bin/{name}'
        argument = '--version' if name != 'hubsql' else '/nonexistent-deploy-check.json'
        command = f'{folder}/lib/ld-linux-x86-64.so.2 --library-path {folder}/lib {folder}/{binary} {argument}'
        if name == 'hubsql':
            command += ' 2>&1 || test "$?" = 1'
        remote(client, command)
    print('Staged only. No services started, no source chains stopped, no databases migrated.')


def main():
    os.umask(0o077)
    CACHE.mkdir(parents=True, exist_ok=True, mode=0o700)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'stage'])
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare()
    else:
        with connect() as client:
            stage(client)


if __name__ == '__main__':
    main()
