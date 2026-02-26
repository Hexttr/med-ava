#!/usr/bin/env python3
"""Full reinstall of better-sqlite3 for current Node version."""
import os
import sys
import paramiko

host = os.environ.get("DEPLOY_HOST", "81.31.245.65")
user = "root"
password = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/med-ava"

if not password:
    print("Set DEPLOY_PASSWORD")
    sys.exit(1)

def safe_print(t):
    try:
        print(t)
    except UnicodeEncodeError:
        print(t.encode("ascii", errors="replace").decode())

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password, timeout=30)

def run(cmd):
    _, out, err = ssh.exec_command(cmd, get_pty=True)
    code = out.channel.recv_exit_status()
    text = out.read().decode("utf-8", errors="replace") + err.read().decode("utf-8", errors="replace")
    return code, text

# Check node versions
print("node -v (default):")
code, text = run("node -v")
safe_print(text)
print("/usr/bin/node -v:")
code, text = run("/usr/bin/node -v")
safe_print(text)
print("which node:")
code, text = run("which node")
safe_print(text)

# Remove node_modules/better-sqlite3 and reinstall
print("Reinstalling better-sqlite3...")
code, text = run(f"cd {APP_DIR} && rm -rf node_modules/better-sqlite3 && npm install better-sqlite3")
safe_print(text[-1500:] if len(text) > 1500 else text)
if code != 0:
    sys.exit(code)

print("Restarting med-ava...")
code, text = run("systemctl restart med-ava")
safe_print(text)

ssh.close()
print("Done. Check: curl http://" + host + ":3000/api/health")
