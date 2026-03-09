# PhotoHUB Enterprise (med-ava)

Система генерации профессиональных портретов для медучреждений. Загружаете фото сотрудника — получаете два варианта: медицинский (белый халат) и корпоративный (деловой стиль). Использует Google Gemini API для анализа и генерации изображений.

---

## Содержание

- [Технологический стек](#технологический-стек)
- [Структура проекта](#структура-проекта)
- [Функциональность](#функциональность)
- [База данных](#база-данных)
- [API](#api)
- [Настройки и переменные окружения](#настройки-и-переменные-окружения)
- [Развёртывание на VPS](#развёртывание-на-vps)
- [Известные особенности](#известные-особенности)

---

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| React | 19.2 |
| База данных | SQLite (better-sqlite3) |
| UI | Radix UI, Tailwind CSS 4, shadcn/ui |
| AI | Google Gemini API (анализ + генерация изображений) |
| Изображения | Sharp (предобработка, превью) |

> **Для AI-агентов:** см. [AGENTS.md](./AGENTS.md) — краткое руководство по проекту и особенностям.

---

## Структура проекта

```
med-ava/
├── app/
│   ├── (app)/                    # Защищённые страницы приложения
│   │   ├── page.tsx               # Главная (дашборд)
│   │   ├── generate/              # Одиночная обработка
│   │   ├── batch/                 # Пакетная обработка
│   │   ├── gallery/               # Галерея портретов
│   │   ├── diagnostic/            # Диагностика сети и логов
│   │   ├── settings/              # Настройки
│   │   └── layout.tsx
│   ├── login/                     # Страница входа
│   ├── api/                       # API-маршруты (см. раздел API)
│   └── layout.tsx
├── components/                    # React-компоненты
│   ├── app-sidebar.tsx            # Боковая навигация
│   ├── portrait-card.tsx          # Карточка портрета (одиночная)
│   ├── batch-portrait-card.tsx    # Карточка в пакетной обработке
│   ├── generate-mode-switch.tsx   # Переключатель режима (Все/1/2)
│   └── ui/                        # shadcn/ui компоненты
├── lib/                           # Бизнес-логика и утилиты
│   ├── db.ts                      # SQLite, миграции, пути
│   ├── auth.ts                    # Сессия, CSRF, rate limit
│   ├── auth-cookie.ts             # Верификация cookie
│   ├── settings.ts                # API-ключ Gemini (файл + env)
│   ├── app-settings.ts            # Настройки из БД
│   ├── storage.ts                 # Сохранение изображений
│   ├── fetch-proxy.ts             # Fetch через SOCKS5/HTTP прокси
│   ├── image-preprocess.ts        # Sharp: предобработка фото перед Gemini
│   ├── prompts.ts                 # Промпты для анализа и генерации
│   ├── model-options.ts           # Опции моделей Gemini
│   ├── structure-api.ts           # CRUD отделов и сотрудников
│   ├── gallery-api.ts             # CRUD галереи
│   ├── logger.ts                  # Логирование (файл + консоль)
│   ├── rate-limit.ts              # Ограничение запросов
│   └── types.ts                   # Общие типы
├── proxy.ts                       # Авторизация (Next.js 16 proxy, см. ниже)
├── data/                          # SQLite + загрузки (gitignore)
│   ├── eam.db
│   ├── eam-logs.jsonl
│   ├── gemini-key
│   └── uploads/
│       ├── employees/
│       ├── gallery/
│       └── backgrounds/
├── deploy/                        # Развёртывание
│   └── deploy.py                  # Деплой через SSH (paramiko)
└── .env.example
```

---

## Функциональность

### 1. Одиночная обработка (`/generate`)

- Загрузка одного фото (перетаскивание или выбор)
- **Поле ФИО** — заполняется автоматически из имени файла при загрузке
- **Режим генерации** (Все / 1 / 2):
  - **Все** — оба портрета (медицинский и корпоративный)
  - **1** — только медицинский;
  - **2** — только корпоративный
- Пустой слот можно догенерировать кнопкой «Сгенерировать»
- Результат: «Было» (оригинал) + «Стало» (2 варианта) с кнопками скачать и перегенерировать

### 2. Пакетная обработка (`/batch`)

- **Отделы** — создание, редактирование, удаление
- **Загрузка сотрудников** — до 50 фото за раз (каждое фото = один сотрудник)
- **Имя сотрудника** — берётся из имени файла (без расширения). Например: `Иванов И.И..jpg` → «Иванов И.И.»
- **Фильтр по отделу** — карточки отделов для выбора
- **Режим генерации** (Все / 1 / 2) — как в одиночной
- **Сгенерировать** — обработка только видимых сотрудников, у которых ещё нет портретов
- **Скачать все** — ZIP-архив со всеми готовыми портретами по текущему фильтру:
  - При совпадении имён добавляются суффиксы: `Иван/`, `Иван_2/`, `Иван_3/`
- **Карточки сотрудников** — Было / Стало (медицинский) / Стало (корпоративный), кнопки «Повторить» и «Скачать»

### 3. Галерея (`/gallery`)

- Список всех сгенерированных портретов
- Фильтр по отделу
- Скачивание по одному (ZIP с medical + corporate)
- Скачивание всех (ZIP с папками по сотрудникам)

### 4. Настройки (`/settings`)

- **API-ключ Gemini** — сохраняется в `data/gemini-key` (приоритет над `GEMINI_API_KEY` из env)
- **Модели** — выбор модели для анализа (Gemini 2.5 Flash/Pro) и генерации (Gemini 3 Pro Image / 2.5 Flash Image)
- **Фоны** — текстовое описание или загрузка изображений для медицинского и корпоративного
- **Промпты** — кастомизация промптов анализа и генерации

### 5. Диагностика (`/diagnostic`)

- **Отчёт** — проверка env (API-ключ, прокси, пароль), БД, портов прокси (10808, 10809)
- **Логи** — логи приложения (ANALYZE, GENERATE, DIAGNOSTIC и др.) из `data/eam-logs.jsonl`
- **Тест API** — проверка подключения к Google Gemini

### 6. Авторизация

- **Пароль** — `EAM_PASSWORD` в .env
- **Сессия** — cookie `eam_session` (7 дней, HMAC-SHA256)
- **CSRF** — защита формы входа
- **Rate limit** — 5 попыток входа за 15 мин на IP

**Важно:** Next.js 16 использует `proxy.ts` напрямую (не middleware). Не создавать `middleware.ts` — это приведёт к конфликту.

---

## База данных

**SQLite** (`data/eam.db`), WAL-режим.

### Таблицы

| Таблица | Описание |
|---------|----------|
| `app_settings` | Key-value настройки (промпты, модели, фоны) |
| `departments` | Отделы (`id`, `name`, `created_at`) |
| `employees` | Сотрудники (`id`, `name`, `photo_path`, `thumbnail_path`, `department_id`, `created_at`) |
| `gallery_items` | Портреты (`id`, `name`, `medical_path`, `corporate_path`, `employee_id`, `created_at`) |
| `_schema_version` | Версия схемы для миграций |

### Миграции

Миграции выполняются автоматически при старте в `lib/db.ts` (функция `runMigrations`).

---

## API

### Auth

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/login` | Вход по паролю |
| GET | `/api/auth/logout` | Выход |
| GET | `/api/auth/csrf` | CSRF-токен |

### Основные

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/analyze` | Анализ фото → промпты |
| POST | `/api/generate` | Генерация портрета (medical/corporate) |
| GET/POST | `/api/gallery` | Список / добавление в галерею |
| GET/PATCH/DELETE | `/api/gallery/[id]` | Один элемент галереи |

### Структура

| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | `/api/departments` | Отделы |
| GET/PATCH/DELETE | `/api/departments/[id]` | Один отдел |
| GET/POST | `/api/employees` | Сотрудники |
| POST | `/api/employees/batch` | Пакетная загрузка (до 100 файлов, 50 MB) |

### Настройки

| Метод | Путь | Описание |
|-------|------|----------|
| GET/PATCH | `/api/settings/app` | Настройки приложения |
| POST/DELETE | `/api/settings/key` | API-ключ Gemini |
| POST | `/api/settings/backgrounds` | Загрузка фонов |

### Система

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/health` | Health check |
| GET | `/api/files/[[...path]]` | Раздача файлов из `data/uploads/` |
| GET | `/api/diagnostic` | Отчёт диагностики |
| GET | `/api/diagnostic/logs` | Логи |
| POST | `/api/diagnostic/test` | Тест Gemini |

---

## Настройки и переменные окружения

### Переменные окружения

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `GEMINI_API_KEY` | Да* | API-ключ Gemini. *Можно задать в настройках (файл `data/gemini-key`) |
| `EAM_PASSWORD` | Нет | Пароль входа. Если задан — все страницы требуют авторизации |
| `EAM_PUBLIC_URL` | Да при self-hosted | Публичный URL (напр. `http://IP:3000`). Без него редиректы на localhost |
| `EAM_HTTPS` | Нет | `true` только при HTTPS (иначе cookies не работают по HTTP) |
| `EAM_HTTPS_PROXY` | Нет | Прокси для запросов к Google (SOCKS5 / HTTP). Пример: `socks5://127.0.0.1:10808` |
| `HTTPS_PROXY` / `HTTP_PROXY` | Нет | Альтернативные переменные прокси |

### Настройки в БД (app_settings)

- `organizationName` — название организации
- `backgroundMedical`, `backgroundCorporate` — текст фонов
- `backgroundMedicalImage`, `backgroundCorporateImage` — пути к изображениям фонов
- `backgroundMode` — `"description"` или `"image"`
- `modelAnalysis`, `modelGeneration` — модели Gemini
- `promptAnalysis`, `promptUniversalFraming`, `promptMedicalInstruction`, `promptCorporateInstruction`, `promptNegative` — промпты

---

## Развёртывание на VPS

### Автоматический деплой (рекомендуется)

- **Ветка:** `ubuntu`
- **Скрипт:** `deploy/deploy.py` (paramiko), путь на сервере: `/opt/med-ava`
- **Порядок:** `git push` → `python deploy/deploy.py`
- **Node на сервере:** `/usr/local/bin/node` (v24) — для better-sqlite3

```bash
$env:DEPLOY_PASSWORD = 'ваш_пароль'
python deploy/deploy.py
```

### Требования

- Node.js 24+ (для better-sqlite3)
- Постоянный диск (SQLite и `data/` должны сохраняться между перезапусками)

### Шаги

1. Клонировать репозиторий
2. Установить зависимости: `npm install`
3. Скопировать `.env.example` в `.env` и заполнить
4. Собрать: `npm run build`
5. Запустить: `npm start`

### systemd (пример)

```ini
[Unit]
Description=PhotoHUB Enterprise
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/med-ava
Environment=NODE_ENV=production
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Важно

- Папка `data/` должна быть доступна для записи
- На VPS в регионе без ограничений Google можно не задавать `EAM_HTTPS_PROXY`
- В регионах с ограничениями — нужен VPN (HAPP и т.п.) и `EAM_HTTPS_PROXY=socks5://127.0.0.1:10808`

---

## Известные особенности

1. **Fallback генерации** — при сбое основной модели (Gemini 3 Pro Image) используется `gemini-2.5-flash-image`, т.к. Imagen 3 (`imagen-3.0-generate-002`) возвращает 404 в Gemini API.

2. **Rate limit** — 60 запросов в минуту на IP для analyze/generate.

3. **Логи** — пишутся в `data/eam-logs.jsonl` (до 5000 строк, ротация). На read-only FS (например, Vercel) запись не выполняется, но приложение не падает.

4. **Авторизация** — Next.js 16 использует `proxy.ts` напрямую. Не создавать `middleware.ts`.

---

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Режим разработки |
| `npm run build` | Сборка |
| `npm start` | Запуск production |
| `npm run lint` | ESLint |
