#!/usr/bin/env python3
"""
Однократная подготовка чистого Ubuntu-сервера под med-ava (Node, git, nginx, certbot, пользователь medava).

Использование:
  set DEPLOY_PASSWORD / DEPLOY_SUDO_PASSWORD (часто одинаковые для user_adm)
  python deploy/bootstrap_server.py
"""

from __future__ import annotations

import argparse
import os
import shlex
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)

KNOWN_HOSTS = Path(__file__).with_name("known_hosts")
DEFAULT_HOST = "178.170.165.78"
DEFAULT_USER = "user_adm"
RUNTIME_USER = "medava"


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


def privileged(command: str, sudo_password: str) -> str:
    return f"echo {shlex.quote(sudo_password)} | sudo -S bash -lc {shlex.quote(command)}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap Ubuntu host for med-ava")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", DEFAULT_USER))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD", ""))
    parser.add_argument(
        "--sudo-password",
        default=os.environ.get("DEPLOY_SUDO_PASSWORD", os.environ.get("DEPLOY_PASSWORD", "")),
    )
    args = parser.parse_args()

    if not args.password:
        raise SystemExit("Нужен --password или DEPLOY_PASSWORD")
    sudo_pw = args.sudo_password.strip()
    if not sudo_pw:
        raise SystemExit("Нужен --sudo-password или DEPLOY_SUDO_PASSWORD (или совпадающий DEPLOY_PASSWORD)")

    if not KNOWN_HOSTS.exists():
        raise SystemExit(f"known_hosts не найден: {KNOWN_HOSTS}")

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
        safe_print("\n=== Анализ системы ===\n")
        _, out, _ = run_ssh(ssh, "uname -a && whoami && id")
        safe_print(out)

        safe_print("\n=== Установка пакетов (apt) ===\n")
        apt_script = (
            "export DEBIAN_FRONTEND=noninteractive && "
            "apt-get update && apt-get install -y curl ca-certificates git nginx "
            "certbot python3-certbot-nginx build-essential"
        )
        run_ssh(ssh, privileged(apt_script, sudo_pw))

        safe_print("\n=== Node.js 24.x (NodeSource) ===\n")
        nodesource = (
            "curl -fsSL https://deb.nodesource.com/setup_24.x | bash - "
            "&& apt-get install -y nodejs && node -v && npm -v"
        )
        run_ssh(ssh, privileged(nodesource, sudo_pw))

        safe_print(f"\n=== Пользователь {RUNTIME_USER} ===\n")
        user_script = (
            f"id -u {RUNTIME_USER} >/dev/null 2>&1 || "
            f"useradd -m -s /bin/bash {RUNTIME_USER}"
        )
        run_ssh(ssh, privileged(user_script, sudo_pw))

        safe_print("\n=== Каталог приложения ===\n")
        run_ssh(ssh, privileged("mkdir -p /opt/med-ava && chmod 755 /opt", sudo_pw))

        safe_print("\n=== Готово к deploy.py ===\n")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
