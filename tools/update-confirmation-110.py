#!/usr/bin/env python3
"""Update only transaction-confirmation frontend files on the existing 110 Hub."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shlex
from datetime import datetime, timezone

FILES = [
    'src/app/lib/transaction-confirmation.ts',
    'src/app/lib/hivex-eth-client.ts',
    'src/app/lib/bridge-client.ts',
    'src/app/lib/bridge-deployment.ts',
    'src/app/pages/bridge/page.tsx',
]
ROOT = Path(__file__).resolve().parents[1]

REMOTE = r'''
import hashlib,json,os,pathlib,shutil,subprocess,time,urllib.request
release=pathlib.Path(RELEASE)
front=pathlib.Path('/srv/hivex-hub/app/frontend')
manifest=json.loads((release/'manifest.json').read_text())
files=manifest['files']
service='hivex-hub-frontend'
nodebase=pathlib.Path('/srv/hivex-hub/app/runtime-bin/node')
node=[str(nodebase/'lib/ld-linux-x86-64.so.2'),'--library-path',str(nodebase/'lib'),str(nodebase/'node')]
def run(args,**kwargs):
    return subprocess.check_output(args,stderr=subprocess.STDOUT,universal_newlines=True,**kwargs)
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def get(path):
    with urllib.request.urlopen('http://127.0.0.1:5174'+path,timeout=10) as response:
        return response.read().decode()
assert run(['systemctl','is-active',service]).strip()=='active'
original={}
for name,expected in files.items():
    source=release/'upload'/name
    assert source.is_file() and digest(source)==expected, 'Upload checksum mismatch: '+name
    target=front/name
    original[name]=digest(target) if target.exists() else None
    if target.exists():
        backup=release/'backup'/name
        backup.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(target,backup)
(release/'original.json').write_text(json.dumps(original,indent=2)+'\n')

# Type-check an overlay first, without interrupting the running frontend.
overlay=release/'check'
overlay.mkdir()
shutil.copytree(front/'src',overlay/'src')
shutil.copy2(front/'tsconfig.json',overlay/'tsconfig.json')
os.symlink(front/'node_modules',overlay/'node_modules',target_is_directory=True)
for name in files:
    shutil.copy2(release/'upload'/name,overlay/name)
output=run(node+[str(front/'node_modules/typescript/bin/tsc'),'--noEmit','--project',str(overlay/'tsconfig.json')],cwd=str(front),timeout=120)
(release/'typecheck.log').write_text(output)
print('Remote overlay typecheck passed',flush=True)

run(['systemctl','stop',service],timeout=120)
assert run(['systemctl','show',service,'--property=MainPID','--value']).strip()=='0', 'Frontend did not stop'
installed=[]
try:
    for name in files:
        target=front/name
        assert (digest(target) if target.exists() else None)==original[name], 'File changed during staging: '+name
    for name in files:
        target=front/name
        temporary=target.with_name(target.name+'.confirmation-upload')
        shutil.copy2(release/'upload'/name,temporary)
        shutil.chown(temporary,user='hubstack',group='hubstack')
        temporary.chmod(0o644)
        os.replace(temporary,target)
        installed.append(name)
    run(['systemctl','start',service],timeout=120)
    for attempt in range(30):
        try:
            text=get('/src/app/lib/transaction-confirmation.ts')
            assert 'TRANSACTION_CONFIRMATION_ATTEMPTS = 20' in text
            assert 'confirmationFailure' in get('/src/app/lib/hivex-eth-client.ts')
            assert 'confirmationFailure' in get('/src/app/lib/bridge-deployment.ts')
            assert 'sourceConfirmationAttempts' in get('/src/app/lib/bridge-client.ts')
            assert 'Recheck saved transaction' in get('/src/app/pages/bridge/page.tsx')
            assert json.loads(get('/api/v1/stats/overview'))['code']==0
            break
        except Exception:
            if attempt==29: raise
            time.sleep(1)
    for name,expected in files.items():
        assert digest(front/name)==expected, 'Installed checksum mismatch: '+name
    assert run(['systemctl','is-active',service]).strip()=='active'
except Exception:
    run(['systemctl','stop',service],timeout=120)
    for name in installed:
        old=original[name]
        target=front/name
        if old is None:
            if target.exists(): target.unlink()
        else:
            shutil.copy2(release/'backup'/name,target)
            shutil.chown(target,user='hubstack',group='hubstack')
    run(['systemctl','start',service],timeout=120)
    print('Restored original frontend files; no node or database changes.',flush=True)
    raise
(release/'result.json').write_text(json.dumps({'status':'verified','files':files,'service':service},indent=2)+'\n')
print('Verified live modules, API, service and all deployed SHA-256 hashes.',flush=True)
print('Backup: '+str(release),flush=True)
'''


def main():
    spec = importlib.util.spec_from_file_location('deploy110', ROOT / 'tools/deploy-110.py')
    deploy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(deploy)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    release = '/srv/hivex-hub/updates/confirmation-' + stamp
    manifest = {'files': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in FILES}}
    with deploy.connect() as client:
        deploy.remote(client, 'install -d -m 700 ' + shlex.quote(release))
        with client.open_sftp() as sftp:
            for name in FILES:
                target = release + '/upload/' + name
                deploy.remote(client, 'install -d -m 700 ' + shlex.quote(str(Path(target).parent)))
                sftp.put(str(ROOT / name), target)
                sftp.chmod(target, 0o600)
            with sftp.file(release + '/manifest.json', 'w') as stream:
                stream.write(json.dumps(manifest, indent=2) + '\n')
        deploy.remote(client, 'python3 -u -c ' + shlex.quote(REMOTE.replace('RELEASE', repr(release))))
    print(json.dumps({'release': release, **manifest}, indent=2))


if __name__ == '__main__':
    main()
