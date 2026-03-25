#!/usr/bin/env python3
"""
Безопасный deploy med-ava по SSH через paramiko.

Ожидаемый workflow:
1. Один раз выполнить bootstrap_production.py
2. Настроить один из способов доступа: DEPLOY_KEY_FILE / DEPLOY_PASSWORD / ssh-agent / стандартный ключ в ~/.ssh
3. Выполнять python deploy/deploy.py для каждого релиза
"""

from __future__ import annotations

import argparse
import os
import sys
import tarfile
import tempfile
import time
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)


DEFAULT_HOST = "81.31.245.65"
DEFAULT_USER = "medava"
REPO_URL = "https://github.com/Hexttr/med-ava.git"
BRANCH = "ubuntu"
APP_DIR = "/opt/med-ava"
PORT = 3000
KNOWN_HOSTS = Path(__file__).with_name("known_hosts")
WORKSPACE_ROOT = Path(__file__).resolve().parents[1]


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


def upload_file(ssh: paramiko.SSHClient, local_path: Path, remote_path: str) -> None:
    sftp = ssh.open_sftp()
    sftp.put(str(local_path), remote_path)
    sftp.close()


def sudo(command: str) -> str:
    return f"sudo -n bash -lc {command!r}"


def describe_auth_method(args: argparse.Namespace) -> str:
    if args.key_file:
        return f"key file: {args.key_file}"
    if args.password:
        return "password"
    return "ssh-agent/default ssh keys"


def dependency_install_command(app_dir: str) -> str:
    return (
        f"cd {app_dir} && "
        "if [ ! -d node_modules ] || [ ! -f .deploy-package-lock ] || ! cmp -s package-lock.json .deploy-package-lock; then "
        "npm ci --prefer-offline --no-audit --fund false && cp package-lock.json .deploy-package-lock; "
        "else "
        "echo 'package-lock unchanged, skipping npm ci'; "
        "fi"
    )


def clean_build_command(app_dir: str) -> str:
    return f"cd {app_dir} && rm -rf .next && npm run build"


def systemd_service(app_dir: str, runtime_user: str) -> str:
    return f"""[Unit]
Description=PhotoHUB Enterprise (med-ava)
After=network.target

[Service]
Type=simple
User={runtime_user}
Group={runtime_user}
WorkingDirectory={app_dir}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
EnvironmentFile={app_dir}/.env
ExecStart=/usr/local/bin/node {app_dir}/node_modules/.bin/next start -H 127.0.0.1 -p {PORT}
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths={app_dir}

[Install]
WantedBy=multi-user.target
"""


def create_release_archive(source_dir: Path) -> Path:
    ignored_dirs = {".git", ".next", "node_modules", "data"}
    ignored_files = {
        Path("deploy/check_server.py"),
    }

    temp_dir = Path(tempfile.mkdtemp(prefix="medava-release-"))
    archive_path = temp_dir / "release.tar.gz"

    with tarfile.open(archive_path, "w:gz") as tar:
        for path in source_dir.rglob("*"):
            relative = path.relative_to(source_dir)
            if relative in ignored_files:
                continue
            if any(part in ignored_dirs for part in relative.parts):
                continue
            tar.add(path, arcname=str(relative))

    return archive_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy med-ava safely to Ubuntu VPS")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", DEFAULT_USER))
    parser.add_argument("--key-file", default=os.environ.get("DEPLOY_KEY_FILE", ""))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD", ""))
    parser.add_argument("--branch", default=os.environ.get("DEPLOY_BRANCH", BRANCH))
    parser.add_argument("--public-url", default=os.environ.get("DEPLOY_PUBLIC_URL", ""))
    parser.add_argument("--app-dir", default=os.environ.get("DEPLOY_APP_DIR", APP_DIR))
    parser.add_argument("--runtime-user", default=os.environ.get("DEPLOY_RUNTIME_USER", DEFAULT_USER))
    parser.add_argument("--upload-local", action="store_true", help="Upload the current local workspace instead of pulling from Git")
    parser.add_argument("--local-source", default=os.environ.get("DEPLOY_LOCAL_SOURCE", str(WORKSPACE_ROOT)))
    parser.add_argument("--skip-build", action="store_true", help="Skip npm run build")
    args = parser.parse_args()

    if not KNOWN_HOSTS.exists():
        raise SystemExit(f"known_hosts file not found: {KNOWN_HOSTS}")

    ssh = load_client(KNOWN_HOSTS)
    connect_kwargs = {
        "hostname": args.host,
        "username": args.user,
        "timeout": 30,
    }
    if args.key_file:
        if not Path(args.key_file).expanduser().exists():
            raise SystemExit(f"Key file not found: {args.key_file}")
        connect_kwargs["key_filename"] = args.key_file
        connect_kwargs["look_for_keys"] = False
        connect_kwargs["allow_agent"] = False
    elif args.password:
        connect_kwargs["password"] = args.password
        connect_kwargs["look_for_keys"] = False
        connect_kwargs["allow_agent"] = False
    else:
        connect_kwargs["look_for_keys"] = True
        connect_kwargs["allow_agent"] = True

    safe_print(f"\n=== Подключение к {args.user}@{args.host} ===\n")
    safe_print(f"--- Способ аутентификации: {describe_auth_method(args)} ---")
    try:
        ssh.connect(**connect_kwargs)
    except paramiko.AuthenticationException as error:
        raise SystemExit(
            "SSH authentication failed. "
            "Provide DEPLOY_KEY_FILE/--key-file, DEPLOY_PASSWORD/--password, "
            "or ensure ssh-agent/default ~/.ssh keys are available."
        ) from error

    try:
        safe_print("--- 1. Подготовка репозитория ---")
        if args.upload_local:
            archive_path = create_release_archive(Path(args.local_source))
            remote_archive = "/tmp/med-ava-release.tar.gz"
            upload_file(ssh, archive_path, remote_archive)
            run_ssh(ssh, f"mkdir -p {args.app_dir}")
            run_ssh(
                ssh,
                f"find {args.app_dir} -mindepth 1 -maxdepth 1 ! -name data ! -name .env -exec rm -rf {{}} +"
            )
            run_ssh(ssh, f"tar -xzf {remote_archive} -C {args.app_dir}")
        else:
            prepare_repo_command = (
                f"mkdir -p {args.app_dir} && "
                f"if test -d {args.app_dir}/.git; then "
                f"cd {args.app_dir} && git fetch origin && git checkout {args.branch} && git pull --ff-only origin {args.branch}; "
                f"else "
                "tmp_dir=$(mktemp -d /tmp/med-ava-clone-XXXXXX) && "
                f"git clone -b {args.branch} {REPO_URL} \"$tmp_dir\" && "
                f"find {args.app_dir} -mindepth 1 -maxdepth 1 ! -name data ! -name .env -exec rm -rf {{}} + && "
                f"cp -a \"$tmp_dir\"/. {args.app_dir}/ && "
                "rm -rf \"$tmp_dir\"; "
                "fi"
            )
            run_ssh(
                ssh,
                prepare_repo_command
            )

        safe_print("\n--- 2. Настройка окружения и прав ---")
        run_ssh(ssh, f"cd {args.app_dir} && test -f .env || cp .env.example .env")
        if args.public_url:
            run_ssh(
                ssh,
                f"cd {args.app_dir} && "
                f"grep -q '^EAM_PUBLIC_URL=' .env && sed -i 's|^EAM_PUBLIC_URL=.*|EAM_PUBLIC_URL={args.public_url}|' .env || echo 'EAM_PUBLIC_URL={args.public_url}' >> .env"
            )
        run_ssh(
            ssh,
            f"cd {args.app_dir} && "
            f"grep -q '^EAM_HTTPS=' .env && sed -i 's|^EAM_HTTPS=.*|EAM_HTTPS=true|' .env || echo 'EAM_HTTPS=true' >> .env"
        )
        run_ssh(
            ssh,
            f"cd {args.app_dir} && "
            "grep -q '^EAM_SESSION_SECRET=' .env || echo \"EAM_SESSION_SECRET=$(openssl rand -hex 32)\" >> .env"
        )
        run_ssh(ssh, sudo(f"mkdir -p {args.app_dir}/data/uploads/employees {args.app_dir}/data/uploads/gallery {args.app_dir}/data/uploads/backgrounds"))
        run_ssh(ssh, sudo(f"chown -R {args.runtime_user}:{args.runtime_user} {args.app_dir}"))
        run_ssh(ssh, sudo(f"chmod 750 {args.app_dir} {args.app_dir}/data {args.app_dir}/data/uploads {args.app_dir}/data/uploads/employees {args.app_dir}/data/uploads/gallery {args.app_dir}/data/uploads/backgrounds"))
        run_ssh(ssh, sudo(f"chmod 600 {args.app_dir}/.env"))
        run_ssh(ssh, sudo(f"test -f {args.app_dir}/data/gemini-key && chmod 600 {args.app_dir}/data/gemini-key || true"))
        run_ssh(ssh, sudo(f"test -f {args.app_dir}/data/eam.db && chmod 640 {args.app_dir}/data/eam.db || true"))
        run_ssh(ssh, sudo(f"test -f {args.app_dir}/data/eam-logs.jsonl && chmod 640 {args.app_dir}/data/eam-logs.jsonl || true"))

        safe_print("\n--- 3. Установка зависимостей и smoke checks ---")
        run_ssh(ssh, dependency_install_command(args.app_dir))
        run_ssh(ssh, f"cd {args.app_dir} && npm run typecheck")
        run_ssh(ssh, f"cd {args.app_dir} && npm run lint")
        if not args.skip_build:
            run_ssh(ssh, clean_build_command(args.app_dir))

        safe_print("\n--- 4. Обновление systemd ---")
        service_content = systemd_service(args.app_dir, args.runtime_user)
        write_remote_file(ssh, "/tmp/med-ava.service", service_content)
        run_ssh(ssh, sudo("install -m 644 /tmp/med-ava.service /etc/systemd/system/med-ava.service"))
        run_ssh(ssh, sudo("systemctl daemon-reload && systemctl enable med-ava && systemctl restart med-ava"))

        safe_print("\n--- 5. Проверка readiness ---")
        time.sleep(3)
        run_ssh(ssh, sudo("systemctl status med-ava --no-pager -l"))
        _, out, _ = run_ssh(ssh, "curl -fsS http://127.0.0.1:3000/api/ready", check=False)
        safe_print(out.strip() or "Readiness endpoint returned no body")

        safe_print("\n=== Развёртывание завершено ===")
        safe_print(f"  Публичный URL: {args.public_url}")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
