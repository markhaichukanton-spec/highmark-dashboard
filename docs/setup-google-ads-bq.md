# Google Ads → BigQuery — Data Transfer Service

**GCP проект:** `aurora-scents-494012`  
**BQ датасет (создать):** `google_ads` (или добавить таблицы в `meta_ads`)  
**Расчётное время:** ~10 минут + данные начнут приходить через 24–48 часов

---

## Вариант 1 — BigQuery Data Transfer Service (рекомендуется)

### 1. Открыть BigQuery Data Transfer
1. Перейди в [console.cloud.google.com/bigquery/transfers](https://console.cloud.google.com/bigquery/transfers?project=aurora-scents-494012)
2. **+ Create Transfer**

### 2. Настроить источник
- **Source:** `Google Ads`
- **Display name:** `aurora-scents-google-ads`
- **Schedule:** `Daily` (23:00 или по дефолту)
- **Destination dataset:** создай новый `google_ads` или используй существующий `meta_ads`

### 3. Google Ads Customer ID
- Это `1234567890` (10 цифр без дефисов) из аккаунта Google Ads
- Найти: Google Ads → правый верхний угол → "Customer ID"
- Вставить в поле **Google Ads Customer ID**

### 4. Авторизовать
- Кнопка **Authorize** → войти через аккаунт, у которого есть доступ к Google Ads аккаунту

### 5. Сохранить → Save

### Что появится в BQ
```
aurora-scents-494012.google_ads.p_Campaign_XXXXXX         ← кампании
aurora-scents-494012.google_ads.p_AdGroup_XXXXXX          ← адгруппы
aurora-scents-494012.google_ads.p_AdGroupAd_XXXXXX        ← объявления
aurora-scents-494012.google_ads.p_AdGroupStats_XXXXXX     ← метрики по адгруппам
aurora-scents-494012.google_ads.p_CampaignStats_XXXXXX    ← метрики по кампаниям
```
(XXXXXX = Customer ID)

---

## Вариант 2 — Looker Studio напрямую (если BQ не нужен)

Looker Studio имеет нативный коннектор Google Ads. Данные можно добавить прямо в LS без BigQuery:
1. В Looker Studio → **Add data source** → **Google Ads**
2. Выбрать аккаунт и метрики
3. Создать вторую страницу отчёта или смешать с Meta-данными через Blended Data

**Ограничение:** нет истории старше 15 месяцев, медленнее, нет кастомных SQL.

---

## После настройки в проекте
- Добавить SQL-вью `meta_ads.google_ads_daily` нормализующую `p_CampaignStats` в общий формат (`date, campaign_name, spend, impressions, clicks, conversions, revenue`)
- Расширить фильтр Source в дашборде на `google_ads`

---

## Проверка
```bash
bq ls aurora-scents-494012:google_ads
bq query --use_legacy_sql=false "SELECT _PARTITIONDATE as date, campaign_name, metrics_cost_micros/1000000 as spend FROM \`aurora-scents-494012.google_ads.p_CampaignStats_*\` LIMIT 5"
```
