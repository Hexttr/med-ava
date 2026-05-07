#!/usr/bin/env python3
"""
Копирует data/ и .env с исходного production-хоста на целевой (останавливает сервис на время замены SQLite).

Пример:
  python deploy/migrate_data.py --source-host 72.56.91.213 --source-user root --source-password ... ^
    --dest-host 178.170.165.78 --dest-user user_adm --dest-password ... --sudo-password ... ^
    --public-url https://ava.nmiczd.ru
"""

from __future__ import annotations

import argparse
import os
import shlex
import sys
import tempfile
import time
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)

KNOWN_HOSTS = Path(__file__).with_name("known_hosts")
APP_DIR = "/opt/med-ava"
REMOTE_TAR = "/tmp/medava-data-migrate.tgz"


def safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())


def run_ssh(ssh: paramiko.SSHClient, command: str, check: bool = True) -> tuple[int, str, str]:
    safe_print(f"  $ {command[:140]}{'...' if len(command) > 140 else ''}")
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


def privileged(command: str, remote_user: str, sudo_password: str | None) -> str:
    qc = shlex.quote(command)
    if remote_user == "root":
        return f"bash -lc {qc}"
    if not sudo_password:
        raise RuntimeError("sudo_password required")
    return f"echo {shlex.quote(sudo_password)} | sudo -S bash -lc {qc}"


def connect(host: str, user: str, password: str) -> paramiko.SSHClient:
    ssh = load_client(KNOWN_HOSTS)
    ssh.connect(host, username=user, password=password, timeout=45, look_for_keys=False, allow_agent=False)
    return ssh


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate med-ava data and .env between servers")
    parser.add_argument("--source-host", default=os.environ.get("MIGRATE_SOURCE_HOST", "72.56.91.213"))
    parser.add_argument("--source-user", default=os.environ.get("MIGRATE_SOURCE_USER", "root"))
    parser.add_argument("--source-password", default=os.environ.get("MIGRATE_SOURCE_PASSWORD", ""))
    parser.add_argument("--dest-host", default=os.environ.get("MIGRATE_DEST_HOST", "178.170.165.78"))
    parser.add_argument("--dest-user", default=os.environ.get("MIGRATE_DEST_USER", "user_adm"))
    parser.add_argument("--dest-password", default=os.environ.get("MIGRATE_DEST_PASSWORD", ""))
    parser.add_argument(
        "--sudo-password",
        default=os.environ.get("DEPLOY_SUDO_PASSWORD", os.environ.get("MIGRATE_DEST_PASSWORD", "")),
    )
    parser.add_argument(
        "--public-url",
        default=os.environ.get("MIGRATE_PUBLIC_URL", ""),
        help="После переноса записать EAM_PUBLIC_URL (напр. https://ava.nmiczd.ru)",
    )
    args = parser.parse_args()

    if not KNOWN_HOSTS.exists():
        raise SystemExit(f"known_hosts не найден: {KNOWN_HOSTS}")
    if not args.source_password:
        raise SystemExit("Нужен --source-password или MIGRATE_SOURCE_PASSWORD")
    if not args.dest_password:
        raise SystemExit("Нужен --dest-password или MIGRATE_DEST_PASSWORD")

    sudo_pw = args.sudo_password.strip() if args.sudo_password else None
    if args.dest_user != "root" and not sudo_pw:
        raise SystemExit("Для целевого не-root пользователя нужен --sudo-password")

    safe_print("\n=== 1. Архив на исходном сервере ===\n")
    src = connect(args.source_host, args.source_user, args.source_password)
    try:
        if args.source_user != "root":
            raise SystemExit("Ожидается source-user root для tar из /opt/med-ava.")

        tar_cmd = f"tar czf {REMOTE_TAR} -C {APP_DIR} data .env && ls -la {REMOTE_TAR}"
        run_ssh(src, tar_cmd)

        sftp = src.open_sftp()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tgz") as tmp:
            local_tar = Path(tmp.name)
        try:
            sftp.get(REMOTE_TAR, str(local_tar))
            safe_print(f"Скачано локально: {local_tar.stat().st_size} байт")
        finally:
            sftp.close()
            run_ssh(src, f"rm -f {REMOTE_TAR}")
    finally:
        src.close()

    safe_print("\n=== 2. Загрузка и распаковка на новом сервере ===\n")
    dst = connect(args.dest_host, args.dest_user, args.dest_password)
    try:
        run_ssh(dst, privileged("systemctl stop med-ava || true", args.dest_user, sudo_pw))

        sftp = dst.open_sftp()
        try:
            sftp.put(str(local_tar), REMOTE_TAR)
        finally:
            sftp.close()

        extract = (
            f"tar xzf {REMOTE_TAR} -C {APP_DIR} && rm -f {REMOTE_TAR} && "
            f"chown -R medava:medava {APP_DIR}/data {APP_DIR}/.env && "
            f"chmod 600 {APP_DIR}/.env && "
            f"test -f {APP_DIR}/data/gemini-key && chmod 600 {APP_DIR}/data/gemini-key || true && "
            f"test -f {APP_DIR}/data/eam.db && chmod 640 {APP_DIR}/data/eam.db || true"
        )
        run_ssh(dst, privileged(extract, args.dest_user, sudo_pw))

        if args.public_url:
            u = args.public_url.replace("&", "\\&")
            run_ssh(
                dst,
                privileged(
                    f"cd {APP_DIR} && if grep -q '^EAM_PUBLIC_URL=' .env; then "
                    f"sed -i 's|^EAM_PUBLIC_URL=.*|EAM_PUBLIC_URL={u}|' .env; "
                    f"else echo 'EAM_PUBLIC_URL={u}' >> .env; fi",
                    args.dest_user,
                    sudo_pw,
                ),
            )
            run_ssh(
                dst,
                privileged(
                    f"cd {APP_DIR} && grep -q '^EAM_HTTPS=' .env && "
                    f"sed -i 's|^EAM_HTTPS=.*|EAM_HTTPS=true|' .env || echo 'EAM_HTTPS=true' >> .env",
                    args.dest_user,
                    sudo_pw,
                ),
            )

        run_ssh(dst, privileged("systemctl start med-ava", args.dest_user, sudo_pw))
        time.sleep(2)
        _, out, _ = run_ssh(dst, "curl -fsS http://127.0.0.1:3000/api/ready")
        safe_print(out)
        safe_print("\n=== Миграция завершена ===")
    finally:
        dst.close()
        try:
            local_tar.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    main()
