#!/usr/bin/env python3
"""Fix systemd to use correct Node path."""
import os
import sys
import paramiko

host = os.environ.get("DEPLOY_HOST", "81.31.245.65")
user = "root"
password = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/med-ava"
PORT = 3000

if not password:
    print("Set DEPLOY_PASSWORD")
    sys.exit(1)

service_content = f"""[Unit]
Description=PhotoHUB Enterprise (med-ava)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={APP_DIR}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/node {APP_DIR}/node_modules/.bin/next start -p {PORT}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password, timeout=30)
sftp = ssh.open_sftp()
with sftp.file("/etc/systemd/system/med-ava.service", "w") as f:
    f.write(service_content)
sftp.close()
ssh.exec_command("systemctl daemon-reload && systemctl restart med-ava")
ssh.close()
print("Updated systemd to use /usr/local/bin/node. Service restarted.")
