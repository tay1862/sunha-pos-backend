"""Local disposable PostgreSQL restore drill, verifies every public table.
Usage: SUNHA_AUDIT_DISPOSABLE=yes python3 ops/restore-drill.py sunha_full_uat_...
Retains restored DB for inspection; removes temporary dump including credentials.
"""
import datetime
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time

source = sys.argv[1] if len(sys.argv) == 2 else ''
if os.environ.get('SUNHA_AUDIT_DISPOSABLE') != 'yes' or not source.startswith('sunha_full_uat_') or not source.replace('_', '').isalnum():
    raise SystemExit('Requires disposable local database named sunha_full_uat_*')
started = time.monotonic()
destination = 'sunha_full_uat_restore_' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')

def query(db, sql):
    return subprocess.check_output(['psql', '-X', '-h', 'localhost', '-d', db, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], text=True).strip()

def fingerprint(db):
    tables = query(db, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines()
    result = {}
    for table in tables:
        quoted = '"' + table.replace('"', '""') + '"'
        rows = query(db, f'SELECT row_to_json(t)::text FROM {quoted} t ORDER BY row_to_json(t)::text')
        result[table] = {'rows': int(query(db, f'SELECT count(*) FROM {quoted}')), 'sha256': hashlib.sha256(rows.encode()).hexdigest()}
    return result

before = fingerprint(source)
with tempfile.TemporaryDirectory(prefix='sunha-restore-') as tmp:
    dump = os.path.join(tmp, 'backup.dump')
    subprocess.run(['pg_dump', '-h', 'localhost', '-Fc', '--no-owner', '-f', dump, source], check=True)
    subprocess.run(['createdb', '-h', 'localhost', destination], check=True)
    subprocess.run(['pg_restore', '-h', 'localhost', '--exit-on-error', '--no-owner', '-d', destination, dump], check=True)
    after = fingerprint(destination)
    assert before == after, 'RESTORE_MISMATCH or source changed during drill'
print(json.dumps({'status': 'PASS', 'source': source, 'restored': destination, 'elapsedSeconds': round(time.monotonic() - started, 2), 'tables': after}, indent=2))
