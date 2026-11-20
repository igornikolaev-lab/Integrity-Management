# Локальний HTTP API MVP

Базовий URL: `http://127.0.0.1:8000`. Формат — `application/json`, UTF-8. Логін повертає cookie `integrity_session`; подальші запити з браузера передають її автоматично.

| Метод / URL | Роль | Дія |
|---|---|---|
| `GET /api/config` | усі | Питання, методика, цикли, категорії |
| `GET /api/me` | усі | Поточний обліковий запис або `null` |
| `POST /api/login` | усі | `{"login":"admin","password":"Demo2026!"}` |
| `POST /api/logout` | будь-хто | Скидання сесії |
| `POST /api/survey` | усі, анонімно | Атомарне групове накопичення оцінок |
| `GET /api/public/summary?cycle=2` | усі | Лише загальні безпечні індикатори |
| `GET /api/dashboard?cycle=2` | admin / leader / analyst | Повний зведений аналіз |
| `GET /api/evidence?cycle=2` | admin / leader / analyst | Контрольні індикатори |
| `POST /api/evidence` | admin / analyst | Статус чек-листа 0/50/100 |
| `GET /api/actions` | admin / leader / analyst | Затверджені заходи |
| `POST /api/actions` | admin / leader | Прийняти рекомендацію, задати виконавця й строк |
| `POST /api/actions/update` | admin / leader | Оновити виконавця/строк/статус |
| `GET /api/audit` | admin / analyst | Журнал управлінських змін |
| `GET /api/report.csv?cycle=2` | admin / leader / analyst | Звіт CSV з BOM UTF-8 |
| `GET /api/report.json?cycle=2` | admin / leader / analyst | Звіт JSON |
| `POST /api/cycles` | admin | Створити цикл `{title,period}` |
| `POST /api/cycles/toggle` | admin | Відкрити / закрити цикл `{id,is_open}` |
| `POST /api/demo/reset` | admin | Відновити початкові штучні дані |

Анонімний запит:

```json
{
  "cycle_id": 2,
  "cohort": "cadets",
  "answers": {
    "leadership": 3, "ethics": 2, "training": 3,
    "compliance": 3, "strategy": 2, "risks": 2,
    "whistle": 3, "progress": 2
  }
}
```

Для валідації сервер вимагає **рівно 8** відомих ключів і цілі оцінки **0–4**; невідомі або незаповнені поля відхиляються.

Дані не передаються в зовнішні системи. Поточний API — **концепція інтеграції**, не промисловий контракт з версіонуванням, авторизацією між сервісами чи OpenAPI.
