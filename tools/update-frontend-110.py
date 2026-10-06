#!/usr/bin/env python3
"""Update frontend application code on the existing 110 stack, preserving runtime state."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shlex
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
FRONT = '/srv/hivex-hub/app/frontend'

REMOTE = r'''
import hashlib,json,os,pathlib,shutil,subprocess,time,urllib.request
release=pathlib.Path(RELEASE)
front=pathlib.Path('/srv/hivex-hub/app/frontend')
manifest=json.loads((release/'manifest.json').read_text())
files=manifest['files']
service='hivex-hub-frontend'
base=pathlib.Path('/srv/hivex-hub/app/runtime-bin/node')
node=[str(base/'lib/ld-linux-x86-64.so.2'),'--library-path',str(base/'lib'),str(base/'node')]
def run(args,**kwargs):
    return subprocess.check_output(args,stderr=subprocess.STDOUT,universal_newlines=True,**kwargs)
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
def get(path):
    with urllib.request.urlopen('http://127.0.0.1:5174'+path,timeout=10) as response: return response.read().decode()
def protected():
    services={s:run(['systemctl','show',s,'--property=MainPID','--value']).strip() for s in ['hivex-hub-indexer','hivex-hub-mysql']}
    services['chain']=run(['ss','-ltnp','sport = :13134']).strip()
    services['routes']=digest(front/'public/bridge/routes.json')
    return services
assert run(['systemctl','is-active',service]).strip()=='active'
before=protected()
original={}
for name,expected in files.items():
    target=front/name
    assert target.resolve().is_relative_to(front.resolve()), 'Unsafe target'
    assert digest(release/'upload'/name)==expected, 'Upload checksum mismatch: '+name
    original[name]=digest(target)
    assert original[name]==manifest['original'][name], 'Target changed during upload: '+name
    if target.exists():
        backup=release/'backup'/name
        backup.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(target,backup)
(release/'original.json').write_text(json.dumps(original,indent=2))
overlay=release/'check'
overlay.mkdir()
shutil.copytree(front/'src',overlay/'src')
(overlay/'tools').mkdir()
for name in ['tsconfig.json','index.html','package.json','vite.config.ts']:
    shutil.copy2(front/name,overlay/name)
for name in ['bridge-deploy-plugin.ts','bridge-rpc-plugin.ts']:
    if (front/'tools'/name).exists(): shutil.copy2(front/'tools'/name,overlay/'tools'/name)
for name in ['node_modules','public','packages']:
    shutil.copytree(front/name,overlay/name,symlinks=True)
for name in ['tools/bridge-lab']:
    os.symlink(front/name,overlay/name,target_is_directory=True)
for name in files:
    target=overlay/name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(release/'upload'/name,target)
env=dict(os.environ,VITE_HIVEX_RPC_URL='http://192.168.1.110:13134',VITE_HUBSQL_API_URL='/')
for label,args in [('typecheck',[str(front/'node_modules/typescript/bin/tsc'),'--noEmit','--project',str(overlay/'tsconfig.json')]),
                   ('build',[str(front/'node_modules/vite/bin/vite.js'),'build'])]:
    try: output=run(node+args,cwd=str(overlay),env=env,timeout=240)
    except subprocess.CalledProcessError as error:
        (release/(label+'.log')).write_text(error.output)
        print(error.output[-6000:],flush=True)
        raise
    (release/(label+'.log')).write_text(output)
    print('Remote '+label+' passed',flush=True)
assert protected()==before, 'Protected services changed during staging'
installed=[]
try:
    run(['systemctl','stop',service],timeout=120)
    assert run(['systemctl','show',service,'--property=MainPID','--value']).strip()=='0'
    for name in files:
        assert digest(front/name)==original[name], 'File changed during build: '+name
    for name in files:
        target=front/name
        if not target.parent.exists():
            target.parent.mkdir(parents=True)
            shutil.chown(target.parent,user='hubstack',group='hubstack')
        temporary=target.with_name(target.name+'.frontend-upload')
        shutil.copy2(release/'upload'/name,temporary)
        shutil.chown(temporary,user='hubstack',group='hubstack')
        temporary.chmod(0o644)
        os.replace(temporary,target)
        installed.append(name)
    run(['systemctl','start',service],timeout=120)
    for attempt in range(30):
        try:
            assert 'okxwallet' in get('/src/app/lib/injected-wallets.ts')
            assert 'okxInjectedConnector()' in get('/src/app/lib/wagmi.ts')
            assert 'announcedOkx' in get('/src/app/providers/wallet-provider.tsx')
            assert '192.168.1.110:13134' in get('/src/app/lib/wallet.ts')
            assert json.loads(get('/api/v1/stats/overview'))['code']==0
            break
        except Exception:
            if attempt==29: raise
            time.sleep(1)
    for name,expected in files.items(): assert digest(front/name)==expected, 'Installed hash mismatch: '+name
    assert run(['systemctl','is-active',service]).strip()=='active'
    assert protected()==before, 'Protected services or routes changed'
except Exception:
    run(['systemctl','stop',service],timeout=120)
    for name in installed:
        target=front/name
        if original[name] is None: target.unlink()
        else: shutil.copy2(release/'backup'/name,target)
    run(['systemctl','start',service],timeout=120)
    print('Frontend files rolled back; no chain/database changes.',flush=True)
    raise
(release/'result.json').write_text(json.dumps({'status':'verified','files':files,'protectedBefore':before,'protectedAfter':protected()},indent=2))
print('Verified frontend modules, checksums, API and unchanged chain/database processes.',flush=True)
print('Backup: '+str(release),flush=True)
'''

def main():
    spec = importlib.util.spec_from_file_location('deploy110', ROOT/'tools/deploy-110.py')
    deploy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(deploy)
    names = [str(p.relative_to(ROOT)) for p in sorted((ROOT/'src').rglob('*')) if p.is_file()]
    names += ['vite.config.ts','tools/bridge-deploy-plugin.ts','tools/bridge-rpc-plugin.ts']
    names += ['index.html', 'public/site.webmanifest']
    names += [str(p.relative_to(ROOT)) for folder in ['packages/sdk/src', 'packages/sdk/dist']
              for p in sorted((ROOT/folder).rglob('*')) if p.is_file()]
    names += [str(p.relative_to(ROOT)) for p in sorted((ROOT/'public').rglob('*.svg'))]
    with deploy.connect() as client:
        # Refuse a dependency/SDK mismatch instead of upgrading packages implicitly.
        with client.open_sftp() as sftp:
            prerequisites=['package-lock.json','tsconfig.json','packages/sdk/package.json']
            remote_package = json.loads(sftp.open(FRONT+'/package.json').read())
            local_package = json.loads((ROOT/'package.json').read_text())
            for field in ['dependencies', 'devDependencies', 'workspaces']:
                assert remote_package.get(field) == local_package.get(field), 'Dependency mismatch: '+field
            for name in prerequisites:
                assert sftp.open(FRONT+'/'+name).read()==(ROOT/name).read_bytes(), 'Dependency mismatch: '+name
        query = 'import hashlib,json,pathlib; r=pathlib.Path('+repr(FRONT)+'); names='+repr(names)+'; print(json.dumps({n:hashlib.sha256((r/n).read_bytes()).hexdigest() if (r/n).is_file() else None for n in names}))'
        _, stdout, stderr = client.exec_command('python3 -c '+shlex.quote(query))
        old = json.loads(stdout.read())
        assert stdout.channel.recv_exit_status()==0, 'Remote inventory failed'
        hashes = {n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in names}
        files = {n:h for n,h in hashes.items() if h!=old[n]}
        if not files:
            print('Frontend source already matches. No restart performed.')
            return
        release='/srv/hivex-hub/updates/frontend-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        deploy.remote(client,'mkdir -m 700 '+shlex.quote(release))
        manifest={'files':files,'original':{n:old[n] for n in files}}
        with client.open_sftp() as sftp:
            for name in files:
                target=release+'/upload/'+name
                deploy.remote(client,'install -d -m 700 '+shlex.quote(str(Path(target).parent)))
                sftp.put(str(ROOT/name),target)
                sftp.chmod(target,0o600)
            with sftp.file(release+'/manifest.json','w') as stream: stream.write(json.dumps(manifest,indent=2))
        print('Staged '+str(len(files))+' changed frontend files.',flush=True)
        deploy.remote(client,'python3 -u -c '+shlex.quote(REMOTE.replace('RELEASE',repr(release))))

if __name__=='__main__': main()
