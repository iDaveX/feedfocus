# FeedFocus — Test Instructions

1) Open the app link (preferably from Telegram as a mini-app).

2) Paste 5–20 lines of user feedback into the input field (one line = one review/ticket/comment).

Example:

Приложение долго открывается  
Поддержка отвечает через сутки  
Не могу найти где изменить тариф  
После обновления приложение стало тормозить  
Непонятно, где посмотреть статус подписки  

3) Click **Анализировать**.

4) Check that the results page shows:

- Pain points (with CJM stage, severity, evidence count, quotes)

5) Open **Гипотезы** and check that:

- Hypotheses are generated
- You can change hypothesis status (new/testing/validated/rejected)

6) Open **Dashboard** and verify aggregated stats are displayed.

7) Send feedback:

- What was accurate / inaccurate?
- Missing CJM stage(s)?
- Hypotheses quality (too generic / actionable)?
- Any UI/UX confusion?

Notes:
- If you opened the app in a regular browser and analysis fails with `Unauthorized: missing Telegram initData`, ask the owner to enable demo mode (`DEV_TELEGRAM_USER_ID` without `TELEGRAM_BOT_TOKEN`) or test inside Telegram.
