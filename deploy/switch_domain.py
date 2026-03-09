#!/usr/bin/env python3
"""
Переключает med-ava на домен и выпускает Let's Encrypt сертификат.
"""

from __future__ import annotations

import argparse
import os
import sys
from textwrap import dedent

try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)


DEFAULT_HOST = "81.31.245.65"
DEFAULT_USER = "root"
APP_DIR = "/opt/med-ava"
NGINX_SITE = "/etc/nginx/sites-available/med-ava"


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


def write_remote_file(ssh: paramiko.SSHClient, remote_path: str, content: str) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote_path, "w") as handle:
        handle.write(content)
    sftp.close()


def nginx_config(domain: str) -> str:
    return dedent(f"""\
    server {{
        listen 80;
        server_name {domain};
        return 301 https://$host$request_uri;
    }}

    server {{
        listen 443 ssl http2;
        server_name {domain};

        ssl_certificate /etc/ssl/med-ava/med-ava.crt;
        ssl_certificate_key /etc/ssl/med-ava/med-ava.key;
        ssl_session_timeout 1d;
        ssl_session_cache shared:medava_ssl:10m;
        ssl_session_tickets off;
        ssl_protocols TLSv1.2 TLSv1.3;

        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

        client_max_body_size 50m;

        location / {{
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 300;
            proxy_send_timeout 300;
        }}
    }}
    """)


def update_public_url(ssh: paramiko.SSHClient, public_url: str) -> None:
    command = (
        "python3 - <<'PY'\n"
        "from pathlib import Path\n"
        f"p = Path('{APP_DIR}/.env')\n"
        "text = p.read_text(encoding='utf-8')\n"
        "lines = text.splitlines()\n"
        "out = []\n"
        "updated = False\n"
        "for line in lines:\n"
        "    if line.startswith('EAM_PUBLIC_URL='):\n"
        f"        out.append('EAM_PUBLIC_URL={public_url}')\n"
        "        updated = True\n"
        "    else:\n"
        "        out.append(line)\n"
        "if not updated:\n"
        f"    out.append('EAM_PUBLIC_URL={public_url}')\n"
        "p.write_text('\\n'.join(out) + '\\n', encoding='utf-8')\n"
        "PY"
    )
    run_ssh(ssh, command)


def remove_systemd_env_override(ssh: paramiko.SSHClient, env_name: str) -> None:
    command = (
        "python3 - <<'PY'\n"
        "from pathlib import Path\n"
        "service = Path('/etc/systemd/system/med-ava.service')\n"
        "if not service.exists():\n"
        "    raise SystemExit(0)\n"
        f"prefix = 'Environment={env_name}='\n"
        "lines = [line for line in service.read_text(encoding='utf-8').splitlines() if not line.startswith(prefix)]\n"
        "service.write_text('\\n'.join(lines) + '\\n', encoding='utf-8')\n"
        "PY"
    )
    run_ssh(ssh, command)


def issue_certificate(ssh: paramiko.SSHClient, domain: str, email: str | None) -> None:
    if email:
        certbot_command = (
            f"certbot --nginx -d {domain} --non-interactive "
            f"--agree-tos -m {email} --redirect"
        )
    else:
        certbot_command = (
            f"certbot --nginx -d {domain} --non-interactive "
            "--agree-tos --register-unsafely-without-email --redirect"
        )
    run_ssh(ssh, certbot_command)


def main() -> None:
    parser = argparse.ArgumentParser(description="Switch med-ava to domain and issue TLS")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", DEFAULT_USER))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD", ""))
    parser.add_argument("--domain", required=True)
    parser.add_argument("--email", default=os.environ.get("LETSENCRYPT_EMAIL", ""))
    args = parser.parse_args()

    if not args.password:
        raise SystemExit("Specify --password or DEPLOY_PASSWORD")

    public_url = f"https://{args.domain}"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, username=args.user, password=args.password, timeout=30)

    try:
        safe_print("--- Install certbot ---")
        run_ssh(ssh, "apt-get update && apt-get install -y certbot python3-certbot-nginx")

        safe_print("--- Update nginx and app URL ---")
        write_remote_file(ssh, NGINX_SITE, nginx_config(args.domain))
        update_public_url(ssh, public_url)
        remove_systemd_env_override(ssh, "EAM_PUBLIC_URL")
        run_ssh(ssh, "nginx -t && systemctl reload nginx")

        safe_print("--- Issue certificate ---")
        issue_certificate(ssh, args.domain, args.email or None)

        safe_print("--- Restart app and verify ---")
        run_ssh(ssh, "systemctl daemon-reload && systemctl restart med-ava && systemctl reload nginx")
        _, out, _ = run_ssh(ssh, f"curl -fsS {public_url}/api/ready")
        safe_print(out)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
