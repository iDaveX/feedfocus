# FeedFocus

AI-инструмент для анализа пользовательских отзывов.

Позволяет:
- анализировать фидбек (отзывы/тикеты/комментарии)
- выявлять pain points и классифицировать по CJM
- генерировать продуктовые гипотезы и трекать статусы
- показывать dashboard инсайтов

## Запуск локально

```bash
npm install
npm run dev
```

Проверка окружения и Supabase: `GET /api/health`.

## Технологии

- Next.js
- Supabase
- Groq
- PostHog

## Deploy (Vercel)

Деплой через Vercel (Next.js App Router + API routes).

Требуемые ENV (production):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY` (рекомендуется)
- `NEXT_PUBLIC_POSTHOG_HOST` (рекомендуется)

Шаблон env: `.env.production.example`  
Инструкция деплоя: `DEPLOY.md`
