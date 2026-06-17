# GA4 → BigQuery — подключение нативного экспорта

**GCP проект:** `aurora-scents-494012`  
**GA4 Property ID:** `428724093`  
**BQ датасет:** создастся автоматически как `analytics_428724093` в датасете на уровне проекта  
**Расчётное время:** ~5 минут кликов + данные появляются на следующий день

---

## Шаги

### 1. Открыть GA4 Admin
1. Перейди на [analytics.google.com](https://analytics.google.com)
2. Выбери Property **Aurora Scents** (ID 428724093)
3. Слева внизу → **Admin** (шестерёнка)
4. В колонке **Property** → **BigQuery Links**

### 2. Создать связь с BigQuery
1. Кнопка **Link**
2. **Choose a BigQuery project** → выбери `aurora-scents-494012`
3. **Data location** → `Europe` (EU) — совпадает с остальными BQ датасетами
4. **Configure data streams and events** → включи нужные стримы (обычно один веб-стрим)
5. **Frequency**: выбери **Daily** (и опционально **Streaming** — для реалтайма, платно через BQ streaming)
6. **Submit**

### 3. Что появится в BigQuery
После первой выгрузки (следующее утро по UTC):
```
aurora-scents-494012.analytics_428724093.events_YYYYMMDD   ← ежедневные таблицы
aurora-scents-494012.analytics_428724093.events_intraday_YYYYMMDD  ← если включён streaming
```

**Схема строки:** `event_date`, `event_timestamp`, `event_name`, `user_pseudo_id`, `geo`, `device`, `traffic_source`, `ecommerce` (purchase events с revenue)

### 4. Что делать дальше в проекте
После появления данных нужно будет:
- Написать SQL-вью `meta_ads.sessions` / `meta_ads.purchases_ga4` для нормализации в формат, совместимый с Meta-данными
- Добавить новый эндпоинт `/api/ga4` в Next.js app
- Добавить источник `google/ga4` в фильтры дашборда

---

## Проверка
```bash
bq ls aurora-scents-494012:analytics_428724093
bq head -n 5 aurora-scents-494012:analytics_428724093.events_YYYYMMDD
```
