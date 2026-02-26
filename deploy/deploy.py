#!/usr/bin/env python3
"""
Скрипт развёртывания med-ava на Ubuntu VPS через SSH (paramiko).
Использование: python deploy.py [--host HOST] [--user USER] [--password PASSWORD]
Или через переменные: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PASSWORD
"""

import argparse
import os
import sys
import time

try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)


DEFAULT_HOST = "81.31.245.65"
DEFAULT_USER = "root"
REPO_URL = "https://github.com/Hexttr/med-ava.git"
BRANCH = "ubuntu"
APP_DIR = "/opt/med-ava"
PORT = 3000


def safe_print(text: str) -> None:
    """Print with fallback for Windows console encoding."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())


def run_ssh(ssh: paramiko.SSHClient, cmd: str, check=True) -> tuple[int, str, str]:
    """Выполнить команду по SSH, вернуть (code, stdout, stderr)."""
    safe_print(f"  $ {cmd[:80]}{'...' if len(cmd) > 80 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if code != 0 and check:
        safe_print(f"  [ERROR] exit {code}")
        safe_print(f"  stdout: {out[-2000:]}")
        safe_print(f"  stderr: {err[-2000:]}")
    return code, out, err


def main():
    parser = argparse.ArgumentParser(description="Deploy med-ava to Ubuntu VPS")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", DEFAULT_USER))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD", ""))
    parser.add_argument("--skip-build", action="store_true", help="Skip npm build (faster re-deploy)")
    args = parser.parse_args()

    if not args.password:
        print("Укажите пароль: --password или DEPLOY_PASSWORD")
        sys.exit(1)

    print(f"\n=== Подключение к {args.user}@{args.host} ===\n")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(args.host, username=args.user, password=args.password, timeout=30)
        print("  SSH подключение установлено.\n")
    except Exception as e:
        print(f"  Ошибка подключения: {e}")
        sys.exit(1)

    steps = []

    # 1. Проверка Node.js
    print("--- 1. Проверка Node.js ---")
    code, out, _ = run_ssh(ssh, "node -v 2>/dev/null || echo 'NOT_FOUND'", check=False)
    if "NOT_FOUND" in out or code != 0:
        print("  Установка Node.js 20...")
        run_ssh(ssh, "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs")
    else:
        print(f"  Node.js: {out.strip()}")
    steps.append("node_ok")

    # 2. Создание директории и клонирование
    print("\n--- 2. Репозиторий ---")
    run_ssh(ssh, f"mkdir -p {APP_DIR} && cd {APP_DIR} && (test -d .git && git fetch origin && git checkout {BRANCH} && git pull origin {BRANCH}) || (git clone -b {BRANCH} {REPO_URL} .)")
    steps.append("repo_ok")

    # 3. Установка зависимостей
    print("\n--- 3. npm install ---")
    run_ssh(ssh, f"cd {APP_DIR} && npm install")
    run_ssh(ssh, f"cd {APP_DIR} && npm rebuild better-sqlite3")
    steps.append("npm_ok")

    # 4. .env
    print("\n--- 4. Конфигурация .env ---")
    run_ssh(ssh, f"cd {APP_DIR} && test -f .env || cp .env.example .env")
    run_ssh(ssh, f"cd {APP_DIR} && grep -q GEMINI_API_KEY .env && echo '.env существует' || true", check=False)
    public_url = f"http://{args.host}:{PORT}"
    run_ssh(ssh, f"cd {APP_DIR} && grep -q '^EAM_PUBLIC_URL=' .env || echo 'EAM_PUBLIC_URL={public_url}' >> .env", check=False)
    steps.append("env_ok")

    # 5. Создание data/
    print("\n--- 5. Директория data/ ---")
    run_ssh(ssh, f"cd {APP_DIR} && mkdir -p data/uploads/employees data/uploads/gallery data/uploads/backgrounds && chmod -R 755 data")
    steps.append("data_ok")

    # 6. Сборка
    if not args.skip_build:
        print("\n--- 6. npm run build ---")
        code, out, err = run_ssh(
            ssh,
            f"cd {APP_DIR} && npm run build > /tmp/build.log 2>&1; e=$?; tail -80 /tmp/build.log; exit $e",
            check=False,
        )
        if code != 0:
            safe_print(f"  Build failed (exit {code}). See output above.")
            raise SystemExit(code)
        steps.append("build_ok")
    else:
        print("\n--- 6. Сборка пропущена (--skip-build) ---")

    # 7. systemd
    print("\n--- 7. systemd сервис ---")
    service_content = f"""[Unit]
Description=PhotoHUB Enterprise (med-ava)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={APP_DIR}
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
Environment=EAM_PUBLIC_URL=http://{args.host}:{PORT}
EnvironmentFile={APP_DIR}/.env
ExecStart=/usr/local/bin/node {APP_DIR}/node_modules/.bin/next start -p {PORT}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    # Записываем через SFTP
    sftp = ssh.open_sftp()
    with sftp.file("/etc/systemd/system/med-ava.service", "w") as f:
        f.write(service_content)
    sftp.close()
    run_ssh(ssh, "systemctl daemon-reload && systemctl enable med-ava && systemctl restart med-ava")
    steps.append("systemd_ok")

    # 8. Проверка
    print("\n--- 8. Проверка ---")
    time.sleep(3)
    run_ssh(ssh, "systemctl status med-ava --no-pager")
    code, out, _ = run_ssh(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{PORT}/api/health 2>/dev/null || echo '000'", check=False)
    if "200" in out or "000" not in out:
        print(f"  Health check: HTTP {out.strip() or 'OK'}")
    else:
        print(f"  Health check: ожидание... (curl: {out})")

    ssh.close()
    print("\n=== Развёртывание завершено ===")
    print(f"  Приложение: http://{args.host}:{PORT}")
    print("  Не забудьте настроить .env (GEMINI_API_KEY, EAM_PASSWORD) на сервере.")
    print(f"  Редактирование: ssh root@{args.host} -> nano /opt/med-ava/.env")


if __name__ == "__main__":
    main()
