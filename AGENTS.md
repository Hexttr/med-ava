# Руководство для AI-агента — PhotoHUB Enterprise (med-ava)

Документ для быстрого погружения нового агента в проект.

---

## Краткое описание

**PhotoHUB Enterprise** — система генерации профессиональных портретов для медучреждений. Загружается фото сотрудника → Gemini анализирует → генерируются два варианта: **медицинский** (белый халат) и **корпоративный** (деловой стиль).

---

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| React | 19.2 |
| БД | SQLite (better-sqlite3) |
| UI | Radix UI, Tailwind CSS 4, shadcn/ui |
| AI | Google Gemini API |
| Изображения | Sharp (предобработка, превью) |

---

## Структура проекта

```
med-ava/
├── app/
│   ├── (app)/           # Защищённые страницы
│   │   ├── page.tsx     # Главная
│   │   ├── generate/    # Одиночная обработка
│   │   ├── batch/       # Пакетная обработка
│   │   ├── gallery/     # Галерея
│   │   ├── diagnostic/  # Диагностика
│   │   └── settings/    # Настройки
│   ├── login/           # Вход
│   └── api/             # API-маршруты
├── components/          # React-компоненты
├── lib/                 # Бизнес-логика
│   ├── db.ts            # SQLite, миграции
│   ├── auth.ts          # Сессия, CSRF, rate limit
│   ├── auth-cookie.ts   # Верификация cookie (для proxy)
│   ├── image-preprocess.ts  # Sharp: предобработка для Gemini
│   ├── prompts.ts       # Промпты (анализ, генерация)
│   ├── storage.ts       # Сохранение изображений
│   ├── fetch-proxy.ts   # Fetch через SOCKS5/HTTP
│   └── ...
├── proxy.ts             # Авторизация (Next.js 16 proxy)
├── deploy/              # Скрипты развёртывания
└── data/                # SQLite, uploads (gitignore)
```

---

## Ключевые особенности (важно знать)

### 1. Next.js 16 — proxy.ts вместо middleware

- Используется **proxy.ts** (не middleware.ts)
- Функция `proxy()` проверяет сессию и редиректит на /login
- **Не создавать** middleware.ts — Next.js 16 использует только proxy.ts

### 2. Авторизация и сессия

- **EAM_PASSWORD** — пароль входа (если задан, все страницы защищены)
- Cookie `eam_session` — HMAC-подписанный токен, 7 дней
- **EAM_HTTPS** — `true` только при HTTPS (иначе cookies не работают по HTTP)
- **EAM_PUBLIC_URL** — обязателен при self-hosted (иначе редиректы идут на localhost)
- После логина — `window.location.assign()` (полная перезагрузка), не router.push
- API при 401 возвращает JSON `{ redirect: "/login?redirect=..." }`, не редирект

### 3. Редиректы и localhost

- Внутренние запросы Next.js могут идти с `request.url = localhost`
- При localhost proxy использует **EAM_PUBLIC_URL** для формирования redirect URL
- Для API-запросов возвращается 401 JSON, для страниц — 303 redirect

### 4. Предобработка изображений (Sharp)

- `lib/image-preprocess.ts` — приводит фото к 1024px, JPEG, перед отправкой в Gemini
- Используется в `/api/analyze` и `/api/generate`
- Оригиналы сохраняются в `data/uploads/`, превью — через Sharp в storage.ts

### 5. Промпты для генерации

- «Рот закрыт» — `Mouth closed, lips together` в промптах и negative prompt
- Промпты в `lib/prompts.ts` и настройках (app_settings)

### 6. Vercel Analytics удалён

- При self-hosted вызывал ошибки (script.js). Не добавлять обратно.

### 7. Logout

- Cookie очищается через `response.cookies.set(..., { maxAge: 0 })`
- Link на logout с `prefetch={false}`

---

## Развёртывание

- **Ветка**: `ubuntu`
- **Сервер**: 81.31.245.65, root
- **Скрипт**: `deploy/deploy.py` (paramiko)
- **Порядок**: `git push` → `python deploy/deploy.py`
- **Пароль**: `DEPLOY_PASSWORD` env или `--password`

```bash
$env:DEPLOY_PASSWORD = 'ваш_пароль'
python deploy/deploy.py
```

- **Путь на сервере**: `/opt/med-ava`
- **Node**: `/usr/local/bin/node` (v24), не /usr/bin/node (v22) — из-за better-sqlite3
- **systemd**: `med-ava.service`, EAM_PUBLIC_URL и EnvironmentFile в unit

---

## Переменные окружения

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| GEMINI_API_KEY | Да* | *Или в настройках (data/gemini-key) |
| EAM_PASSWORD | Нет | Пароль входа |
| EAM_HTTPS_PROXY | Нет | Прокси для Google (socks5://127.0.0.1:10808) |
| EAM_HTTPS | Нет | true только при HTTPS |
| EAM_PUBLIC_URL | Да при self-hosted | http://IP:3000 |

---

## API (основное)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/auth/login | Вход |
| GET | /api/auth/logout | Выход |
| GET | /api/auth/csrf | CSRF-токен |
| POST | /api/analyze | Анализ фото → промпты |
| POST | /api/generate | Генерация портрета |
| GET/POST | /api/gallery | Галерея |
| GET/POST | /api/departments | Отделы |
| POST | /api/employees/batch | Пакетная загрузка |
| GET | /api/health | Health check |

---

## БД (SQLite)

- `data/eam.db`
- Таблицы: app_settings, departments, employees, gallery_items, _schema_version
- Миграции в `lib/db.ts` (runMigrations)

---

## Где искать при типичных задачах

| Задача | Файлы |
|--------|-------|
| Изменить логику авторизации | proxy.ts, lib/auth.ts, lib/auth-cookie.ts |
| Промпты для Gemini | lib/prompts.ts, app/settings |
| Предобработка изображений | lib/image-preprocess.ts |
| Сохранение файлов | lib/storage.ts |
| API analyze/generate | app/api/analyze/route.ts, app/api/generate/route.ts |
| Пакетная обработка | app/(app)/batch/, app/api/employees/batch/ |
| Развёртывание | deploy/deploy.py |

---

## Быстрый старт (локально)

```bash
npm install
cp .env.example .env   # заполнить GEMINI_API_KEY
npm run dev
```

---

## Известные проблемы (уже решены)

1. **middleware.ts + proxy.ts** — Next.js 16 не допускает оба; оставлен только proxy.ts
2. **better-sqlite3** — нужен Node 24 для совместимости; systemd использует /usr/local/bin/node
3. **Сессия не сохранялась** — cookie на Response, window.location после логина
4. **localhost в редиректах** — EAM_PUBLIC_URL в systemd
5. **API 401** — для /api/* возвращается JSON, не redirect
6. **Logout 500** — cookie через response.cookies.set, не cookies().delete()
