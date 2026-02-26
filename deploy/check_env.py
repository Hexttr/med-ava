#!/usr/bin/env python3
"""Check systemd service and env on server."""
import os
import sys
import paramiko

host = os.environ.get("DEPLOY_HOST", "81.31.245.65")
user = "root"
password = os.environ.get("DEPLOY_PASSWORD", "")

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

_, out, _ = ssh.exec_command("cat /etc/systemd/system/med-ava.service")
safe_print(out.read().decode())

_, out, _ = ssh.exec_command("grep EAM_PUBLIC /opt/med-ava/.env 2>/dev/null || echo 'not found'")
safe_print("--- .env EAM_PUBLIC ---")
safe_print(out.read().decode())

ssh.close()
