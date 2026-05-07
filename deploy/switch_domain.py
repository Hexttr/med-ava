#!/usr/bin/env python3
"""
Настраивает nginx + Let's Encrypt для med-ava и обновляет EAM_PUBLIC_URL в .env.

Ожидается HTTP-блок на :80 (certbot добавит HTTPS).

Использование:
  python deploy/switch_domain.py --domain ava.nmiczd.ru --password ... --sudo-password ...
"""

from __future__ import annotations

import argparse
import os
import shlex
import sys
import time
from pathlib import Path
from textwrap import dedent

try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)

DEFAULT_HOST = "178.170.165.78"
DEFAULT_USER = "user_adm"
APP_DIR = "/opt/med-ava"
NGINX_SITE = "/etc/nginx/sites-available/med-ava"
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


def write_remote_file(ssh: paramiko.SSHClient, remote_path: str, content: str) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote_path, "w") as handle:
        handle.write(content)
    sftp.close()


def load_client(known_hosts_path: Path) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.load_host_keys(str(known_hosts_path))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    return client


def privileged(command: str, remote_user: str, sudo_password: str | None) -> str:
    qc = shlex.quote(command)
    if remote_user == "root":
        return f"bash -lc {qc}"
    if not sudo_password:
        raise RuntimeError("sudo_password required for non-root")
    return f"echo {shlex.quote(sudo_password)} | sudo -S bash -lc {qc}"


def nginx_http_only(domain: str) -> str:
    """HTTP proxy до выпуска сертификата (certbot добавит ssl server)."""
    return dedent(f"""\
    server {{
        listen 80;
        server_name {domain};

        client_max_body_size 100m;

        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;

        location / {{
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 300;
            proxy_send_timeout 300;
        }}
    }}
    """)


def update_public_url(ssh: paramiko.SSHClient, public_url: str, remote_user: str, sudo_password: str | None) -> None:
    py = (
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
    run_ssh(ssh, privileged(py, remote_user, sudo_password))


def issue_certificate(
    ssh: paramiko.SSHClient,
    domain: str,
    email: str | None,
    remote_user: str,
    sudo_password: str | None,
) -> None:
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
    run_ssh(ssh, privileged(certbot_command, remote_user, sudo_password))


def main() -> None:
    parser = argparse.ArgumentParser(description="Configure nginx + TLS for med-ava")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", DEFAULT_USER))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD", ""))
    parser.add_argument(
        "--sudo-password",
        default=os.environ.get("DEPLOY_SUDO_PASSWORD", os.environ.get("DEPLOY_PASSWORD", "")),
    )
    parser.add_argument("--domain", required=True)
    parser.add_argument("--email", default=os.environ.get("LETSENCRYPT_EMAIL", ""))
    args = parser.parse_args()

    if not args.password:
        raise SystemExit("Specify --password or DEPLOY_PASSWORD")
    sudo_pw = args.sudo_password.strip() if args.sudo_password else None
    if args.user != "root" and not sudo_pw:
        raise SystemExit("Non-root requires --sudo-password or DEPLOY_SUDO_PASSWORD")

    if not KNOWN_HOSTS.exists():
        raise SystemExit(f"known_hosts file not found: {KNOWN_HOSTS}")

    public_url = f"https://{args.domain}"

    ssh = load_client(KNOWN_HOSTS)
    ssh.connect(
        args.host,
        username=args.user,
        password=args.password,
        timeout=30,
        look_for_keys=False,
        allow_agent=False,
    )

    try:
        safe_print("--- Запись nginx (HTTP, certbot добавит TLS) ---")
        write_remote_file(ssh, "/tmp/med-ava.nginx", nginx_http_only(args.domain))
        run_ssh(
            ssh,
            privileged(
                f"install -m 644 /tmp/med-ava.nginx {NGINX_SITE} && "
                f"ln -sf {NGINX_SITE} /etc/nginx/sites-enabled/med-ava && "
                "rm -f /etc/nginx/sites-enabled/default",
                args.user,
                sudo_pw,
            ),
        )

        safe_print("--- .env: EAM_PUBLIC_URL + HTTPS ---")
        update_public_url(ssh, public_url, args.user, sudo_pw)
        run_ssh(
            ssh,
            privileged(
                f"cd {APP_DIR} && grep -q '^EAM_HTTPS=' .env && sed -i 's|^EAM_HTTPS=.*|EAM_HTTPS=true|' .env || echo 'EAM_HTTPS=true' >> .env",
                args.user,
                sudo_pw,
            ),
        )

        safe_print("--- nginx -t && reload ---")
        run_ssh(ssh, privileged("nginx -t && systemctl reload nginx", args.user, sudo_pw))

        safe_print("--- certbot ---")
        issue_certificate(ssh, args.domain, args.email or None, args.user, sudo_pw)

        safe_print("--- Перезапуск приложения ---")
        run_ssh(ssh, privileged("systemctl restart med-ava && systemctl reload nginx", args.user, sudo_pw))

        safe_print("--- Проверка ---")
        last_err = ""
        for attempt in range(1, 6):
            time.sleep(3)
            code, out, err = run_ssh(ssh, f"curl -fsS {public_url}/api/ready", check=False)
            if code == 0:
                safe_print(out)
                safe_print("\n=== Готово ===")
                return
            last_err = out + err
            safe_print(f"Попытка {attempt}/5: сервис ещё поднимается…")
        raise RuntimeError(f"Readiness по HTTPS не прошёл после нескольких попыток:\n{last_err}")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
