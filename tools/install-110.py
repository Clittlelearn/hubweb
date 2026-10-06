#!/usr/bin/env python3
"""Remote bootstrap. Only manages /srv/hivex-hub and hivex-hub-* systemd units."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import time

ROOT = Path('/srv/hivex-hub')
APP = ROOT / 'app'
STATE = ROOT / 'state'
USER = 'hubstack'


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def write(path, content, mode=0o600):
    path.write_text(content)
    path.chmod(mode)


def binary(family, name):
    folder = APP / 'runtime-bin' / family
    return [str(folder / 'lib/ld-linux-x86-64.so.2'), '--library-path',
            str(folder / 'lib'), str(folder / name)]


def unit(name, command, cwd, after='', requires='', environment='', conditions=''):
    text = f'''[Unit]
Description=HiveX Hub {name}
After=network-online.target {after}
Wants=network-online.target
{f'Requires={requires}' if requires else ''}
StartLimitIntervalSec=120
StartLimitBurst=3
{conditions}

[Service]
Type=simple
User={USER}
Group={USER}
WorkingDirectory={cwd}
ExecStart={' '.join(command)}
{environment}
Restart=on-failure
RestartSec=5
TimeoutStopSec=90
SendSIGKILL=no
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths={ROOT}
Nice=5

[Install]
WantedBy=multi-user.target
'''
    write(Path('/etc/systemd/system') / f'hivex-hub-{name}.service', text, 0o644)


def main():
    os.umask(0o077)
    if APP.exists() or STATE.exists():
        raise SystemExit('Existing installation detected. Refusing to overwrite its application/data.')
    (ROOT / 'staged').rename(APP)
    if subprocess.run(['id', '-u', USER], stdout=subprocess.DEVNULL).returncode:
        run(['useradd', '--system', '--home-dir', str(ROOT), '--shell', '/usr/sbin/nologin', USER])
    for directory in ['mysql-data', 'mysql-run', 'hubsql-data', 'logs']:
        (STATE / directory).mkdir(parents=True)
    (APP / 'frontend/tools/bridge-lab/runtime').mkdir(mode=0o700)
    config = ROOT / 'config'
    config.mkdir()
    password = secrets.token_hex(24)
    root_password = secrets.token_hex(24)
    write(config / 'mysql.cnf', f'''[mysqld]
basedir={APP}/mysql
datadir={STATE}/mysql-data
socket={STATE}/mysql-run/mysql.sock
pid-file={STATE}/mysql-run/mysql.pid
log-error={STATE}/logs/mysql.log
port=3306
bind-address=127.0.0.1
mysqlx=0
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
innodb_buffer_pool_size=256M
max_connections=40
''')
    write(config / 'hubsql.json', json.dumps({
        'chain': {'base_url': 'http://127.0.0.1:13134', 'start_height': 0,
                  'sync_interval_seconds': 3, 'batch_size': 50,
                  'http': {'timeout_ms': 10000, 'retry': 3, 'max_retry_wait_ms': 60000}},
        'mysql': {'host': '127.0.0.1', 'port': 3306, 'user': 'hubsql',
                  'password': password, 'database': 'hubsql', 'pool_size': 6},
        'api': {'host': '127.0.0.1', 'port': 8080, 'threads': 2},
        'log': {'level': 'info', 'file': str(STATE / 'logs/hubsql.log')},
        'rocksdb': {'path': str(STATE / 'hubsql-data/utxo')},
    }, indent=2))
    run(['chown', '-R', f'{USER}:{USER}', str(ROOT)])
    initialize = binary('mysql', 'mysqld') + [f'--defaults-file={config}/mysql.cnf', '--initialize-insecure']
    run(['runuser', '-u', USER, '--'] + initialize)
    unit('mysql', binary('mysql', 'mysqld') + [f'--defaults-file={config}/mysql.cnf'], STATE)
    unit('indexer', binary('hubsql', 'hubsql') + [str(config / 'hubsql.json')], STATE,
         after='hivex-hub-mysql.service', requires='hivex-hub-mysql.service')
    front = APP / 'frontend'
    # Do not advertise localhost routes that still belong to the developer's chains.
    (front / 'public/bridge/routes.json').rename(config / 'routes.pending.json')
    node = binary('node', 'node')
    unit('frontend', node + [str(front / 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
                             '--port', '5174', '--strictPort'], front,
         after='hivex-hub-indexer.service', environment='''Environment=VITE_HIVEX_RPC_URL=http://192.168.1.110:13134
Environment=HIVEX_DEV_RPC_URL=http://127.0.0.1:13134
Environment=VITE_HUBSQL_API_URL=/
Environment=HUBSQL_API_URL=http://127.0.0.1:8080''')
    lab = front / 'tools/bridge-lab'
    unit('bsc', node + [str(lab / 'chain.mjs')], lab,
         conditions=f'ConditionPathExists={lab}/runtime/local-account.json\nConditionPathExists={lab}/runtime/bsc-db/CURRENT')
    unit('evm', node + [str(lab / 'chain.mjs'), '--evm'], lab,
         conditions=f'ConditionPathExists={lab}/runtime/local-account.json\nConditionPathExists={lab}/runtime/evm-db/CURRENT')
    unit('relay', node + [str(lab / 'relay.mjs')], lab,
         after='hivex-hub-bsc.service hivex-hub-evm.service',
         requires='hivex-hub-bsc.service hivex-hub-evm.service',
         conditions=f'ConditionPathExists={lab}/runtime/relayer.json\nConditionPathExists={front}/public/bridge/routes.json')
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'enable', '--now', 'hivex-hub-mysql'])
    socket = str(STATE / 'mysql-run/mysql.sock')
    for _ in range(45):
        check = subprocess.run(binary('mysql', 'mysqladmin') + [f'--socket={socket}', '-uroot', 'ping'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if check.returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError('MySQL did not become ready. No chains were started.')
    schema = (APP / 'hubsql/sql/schema.sql').read_text()
    sql = f"CREATE DATABASE hubsql CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
    for host in ['localhost', '127.0.0.1']:
        sql += f"CREATE USER 'hubsql'@'{host}' IDENTIFIED BY '{password}';\n"
        sql += f"GRANT ALL ON hubsql.* TO 'hubsql'@'{host}';\n"
    sql += 'USE hubsql;\n' + schema
    sql += f"\nALTER USER 'root'@'localhost' IDENTIFIED BY '{root_password}';\n"
    result = subprocess.run(binary('mysql', 'mysql') + [f'--socket={socket}', '-uroot'],
                            input=sql, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Schema initialization failed. Inspect private MySQL logs; SQL was not printed.')
    write(config / 'mysql-admin.cnf', f'[client]\nuser=root\npassword={root_password}\nsocket={socket}\n')
    run(['systemctl', 'enable', '--now', 'hivex-hub-indexer', 'hivex-hub-frontend'])
    print('Installed MySQL, HubSQL and loopback frontend. Bridge chains/relayer remain stopped pending migration.')


if __name__ == '__main__':
    main()
