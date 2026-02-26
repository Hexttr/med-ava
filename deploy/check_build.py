#!/usr/bin/env python3
"""Quick script to fetch build log from server."""
import os
import sys
import paramiko

host = os.environ.get("DEPLOY_HOST", "81.31.245.65")
user = "root"
password = os.environ.get("DEPLOY_PASSWORD", "")

if not password:
    print("Set DEPLOY_PASSWORD")
    sys.exit(1)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password, timeout=30)
_, out, _ = ssh.exec_command("cat /tmp/build.log 2>/dev/null || echo 'No log'")
text = out.read().decode("utf-8", errors="replace")
try:
    print(text)
except UnicodeEncodeError:
    print(text.encode("ascii", errors="replace").decode())
ssh.close()
