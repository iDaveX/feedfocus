# FeedFocus

AI-инструмент для анализа пользовательских отзывов.

Позволяет:
- анализировать фидбек (отзывы/тикеты/комментарии)
- выявлять pain points и классифицировать по CJM
- генерировать продуктовые гипотезы и трекать статусы

## Запуск локально

```bash
npm install
npm run dev
```

Проверка окружения и Supabase: `GET /api/health`.

## Deploy (Vercel)

Деплой через Vercel (Next.js App Router + API routes).

Требуемые ENV (production):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `DEV_TELEGRAM_USER_ID` (опционально — для demo-mode в браузере)

Шаблон env: `.env.production.example`  
Инструкция деплоя: `DEPLOY.md`
