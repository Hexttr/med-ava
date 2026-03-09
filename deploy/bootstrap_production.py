#!/usr/bin/env python3
"""
Первичная подготовка production-сервера med-ava.

Что делает:
- проверяет host key через deploy/known_hosts
- подключается по SSH как root
- создаёт пользователя medava
- ставит nginx/ufw/openssl
- настраивает reverse proxy на 80/443
- включает self-signed TLS для IP-адреса
- включает backup timer
- опционально удаляет старые каталоги bot-приложений
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)


DEFAULT_HOST = "81.31.245.65"
DEFAULT_ROOT_USER = "root"
DEFAULT_RUNTIME_USER = "medava"
DEFAULT_APP_DIR = "/opt/med-ava"
KNOWN_HOSTS = Path(__file__).with_name("known_hosts")


def safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())


def run_ssh(ssh: paramiko.SSHClient, command: str, check: bool = True) -> tuple[int, str, str]:
    safe_print(f"  $ {command[:120]}{'...' if len(command) > 120 else ''}")
    _, stdout, stderr = ssh.exec_command(command, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if code != 0 and check:
        raise RuntimeError(f"Command failed ({code}): {command}\nstdout:\n{out[-4000:]}\nstderr:\n{err[-4000:]}")
    return code, out, err


def load_client(known_hosts_path: Path) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.load_host_keys(str(known_hosts_path))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    return client


def write_remote_file(ssh: paramiko.SSHClient, remote_path: str, content: str, mode: int | None = None) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote_path, "w") as handle:
        handle.write(content)
    if mode is not None:
        sftp.chmod(remote_path, mode)
    sftp.close()


def nginx_config(public_host: str, cert_path: str, key_path: str) -> str:
    return f"""server {{
    listen 80;
    server_name {public_host};
    return 301 https://$host$request_uri;
}}

server {{
    listen 443 ssl http2;
    server_name {public_host};

    ssl_certificate {cert_path};
    ssl_certificate_key {key_path};
    ssl_session_timeout 1d;
    ssl_session_cache shared:medava_ssl:10m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;

    client_max_body_size 50m;

    location / {{
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }}
}}
"""


def backup_script(app_dir: str, runtime_user: str) -> str:
    return f"""#!/usr/bin/env bash
set -euo pipefail

APP_DIR="{app_dir}"
DATA_DIR="$APP_DIR/data"
BACKUP_ROOT="/var/backups/med-ava"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_ROOT/$STAMP"

mkdir -p "$TARGET"

if [ -f "$DATA_DIR/eam.db" ]; then
  install -m 640 -o {runtime_user} -g {runtime_user} "$DATA_DIR/eam.db" "$TARGET/eam.db"
fi

if [ -f "$DATA_DIR/gemini-key" ]; then
  install -m 600 -o {runtime_user} -g {runtime_user} "$DATA_DIR/gemini-key" "$TARGET/gemini-key"
fi

if [ -d "$DATA_DIR/uploads" ]; then
  tar -C "$DATA_DIR" -czf "$TARGET/uploads.tar.gz" uploads
fi

find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d | sort | head -n -7 | xargs -r rm -rf
"""


BACKUP_SERVICE = """[Unit]
Description=med-ava backup

[Service]
Type=oneshot
ExecStart=/usr/local/bin/med-ava-backup.sh
"""


BACKUP_TIMER = """[Unit]
Description=Run med-ava backup every 6 hours

[Timer]
OnCalendar=*-*-* 00/6:00:00
Persistent=true

[Install]
WantedBy=timers.target
"""


def ensure_runtime_user(ssh: paramiko.SSHClient, runtime_user: str, app_dir: str) -> None:
    run_ssh(ssh, f"id -u {runtime_user} >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash {runtime_user}")
    run_ssh(ssh, f"mkdir -p {app_dir} {app_dir}/data /var/backups/med-ava")
    run_ssh(ssh, f"chown -R {runtime_user}:{runtime_user} {app_dir} /var/backups/med-ava")
    run_ssh(ssh, f"chmod 750 {app_dir} {app_dir}/data /var/backups/med-ava")


def ensure_authorized_key(ssh: paramiko.SSHClient, runtime_user: str, public_key: str) -> None:
    key = public_key.strip()
    if not key:
        return

    escaped = key.replace("'", "'\"'\"'")
    home = f"/home/{runtime_user}"
    run_ssh(ssh, f"mkdir -p {home}/.ssh && chmod 700 {home}/.ssh")
    run_ssh(
        ssh,
        f"grep -qxF '{escaped}' {home}/.ssh/authorized_keys 2>/dev/null || echo '{escaped}' >> {home}/.ssh/authorized_keys"
    )
    run_ssh(ssh, f"chmod 600 {home}/.ssh/authorized_keys && chown -R {runtime_user}:{runtime_user} {home}/.ssh")


def configure_sudoers(ssh: paramiko.SSHClient, runtime_user: str) -> None:
    content = f"{runtime_user} ALL=(root) NOPASSWD: ALL\n"
    write_remote_file(ssh, f"/etc/sudoers.d/{runtime_user}-deploy", content, 0o440)


def install_base_packages(ssh: paramiko.SSHClient) -> None:
    run_ssh(ssh, "apt-get update && apt-get install -y nginx ufw openssl")


def ensure_self_signed_cert(ssh: paramiko.SSHClient, host: str) -> tuple[str, str]:
    cert_dir = "/etc/ssl/med-ava"
    cert_path = f"{cert_dir}/med-ava.crt"
    key_path = f"{cert_dir}/med-ava.key"

    run_ssh(ssh, f"mkdir -p {cert_dir}")
    cmd = (
        f"test -f {cert_path} && test -f {key_path} || "
        f"openssl req -x509 -nodes -newkey rsa:4096 -days 825 "
        f"-keyout {key_path} -out {cert_path} "
        f"-subj '/CN={host}' "
        f"-addext 'subjectAltName = IP:{host}'"
    )
    run_ssh(ssh, cmd)
    run_ssh(ssh, f"chmod 600 {key_path} && chmod 644 {cert_path}")
    return cert_path, key_path


def configure_nginx(ssh: paramiko.SSHClient, host: str) -> None:
    cert_path, key_path = ensure_self_signed_cert(ssh, host)
    content = nginx_config(host, cert_path, key_path)
    write_remote_file(ssh, "/etc/nginx/sites-available/med-ava", content)
    run_ssh(ssh, "ln -sfn /etc/nginx/sites-available/med-ava /etc/nginx/sites-enabled/med-ava")
    run_ssh(ssh, "rm -f /etc/nginx/sites-enabled/default")
    run_ssh(ssh, "nginx -t && systemctl enable nginx && systemctl restart nginx")


def configure_backups(ssh: paramiko.SSHClient, app_dir: str, runtime_user: str) -> None:
    write_remote_file(ssh, "/usr/local/bin/med-ava-backup.sh", backup_script(app_dir, runtime_user), 0o750)
    write_remote_file(ssh, "/etc/systemd/system/med-ava-backup.service", BACKUP_SERVICE)
    write_remote_file(ssh, "/etc/systemd/system/med-ava-backup.timer", BACKUP_TIMER)
    run_ssh(ssh, "systemctl daemon-reload && systemctl enable --now med-ava-backup.timer")


def configure_firewall(ssh: paramiko.SSHClient) -> None:
    run_ssh(ssh, "ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable")


def maybe_remove_legacy_apps(ssh: paramiko.SSHClient) -> None:
    code, out, _ = run_ssh(
        ssh,
        "rg -n '/opt/(clawdbot|moltbot)|clawdbot|moltbot' /etc/systemd /etc/cron* /root /etc 2>/dev/null || true",
        check=False,
    )
    if out.strip():
        safe_print("  Legacy app references were found; skipping deletion.")
        safe_print(out[-4000:])
        return

    run_ssh(ssh, "rm -rf /opt/clawdbot /opt/moltbot /opt/clawdbot-bundle.tar.gz")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap med-ava production server")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", DEFAULT_HOST))
    parser.add_argument("--root-user", default=os.environ.get("DEPLOY_ROOT_USER", DEFAULT_ROOT_USER))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD", ""))
    parser.add_argument("--key-file", default=os.environ.get("DEPLOY_KEY_FILE", ""))
    parser.add_argument("--runtime-user", default=os.environ.get("DEPLOY_RUNTIME_USER", DEFAULT_RUNTIME_USER))
    parser.add_argument("--app-dir", default=os.environ.get("DEPLOY_APP_DIR", DEFAULT_APP_DIR))
    parser.add_argument("--deploy-public-key-file", default=os.environ.get("DEPLOY_PUBLIC_KEY_FILE", ""))
    parser.add_argument("--remove-legacy-apps", action="store_true")
    args = parser.parse_args()

    if not KNOWN_HOSTS.exists():
        raise SystemExit(f"known_hosts file not found: {KNOWN_HOSTS}")

    if not args.password and not args.key_file:
        raise SystemExit("Specify --password or --key-file for bootstrap access")

    public_key = ""
    if args.deploy_public_key_file:
        public_key = Path(args.deploy_public_key_file).read_text(encoding="utf-8").strip()

    ssh = load_client(KNOWN_HOSTS)
    connect_kwargs = {
        "hostname": args.host,
        "username": args.root_user,
        "timeout": 30,
        "look_for_keys": False,
        "allow_agent": False,
    }
    if args.key_file:
        connect_kwargs["key_filename"] = args.key_file
    else:
        connect_kwargs["password"] = args.password

    safe_print(f"=== Bootstrap production on {args.root_user}@{args.host} ===")
    ssh.connect(**connect_kwargs)
    try:
        install_base_packages(ssh)
        ensure_runtime_user(ssh, args.runtime_user, args.app_dir)
        if public_key:
            ensure_authorized_key(ssh, args.runtime_user, public_key)
        configure_sudoers(ssh, args.runtime_user)
        configure_backups(ssh, args.app_dir, args.runtime_user)
        configure_nginx(ssh, args.host)
        configure_firewall(ssh)
        if args.remove_legacy_apps:
            maybe_remove_legacy_apps(ssh)
        safe_print("Bootstrap completed successfully.")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
