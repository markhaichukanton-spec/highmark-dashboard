# Looker Studio — страница Placements (raw_ad_placements)

**Таблица BQ:** `aurora-scents-494012.meta_ads.raw_ad_placements`  
**Строк:** ~281K | Разбивка: publisher_platform × platform_position × date × campaign × ad  
**Расчётное время:** ~15 минут

---

## Зачем

`raw_ad_placements` показывает эффективность по площадкам размещения (Instagram Feed, Facebook Stories, Reels, Audience Network и т.д.). Уже наполнена данными с 2025-01-01, обновляется ежедневно Cloud Function.

---

## Схема (17 колонок)

| Колонка | Тип | Примечание |
|---------|-----|------------|
| `date` | DATE | Партиция по MONTH |
| `source` | STRING | всегда "meta" |
| `account_id` | STRING | |
| `publisher_platform` | STRING | facebook / instagram / audience_network / messenger |
| `platform_position` | STRING | feed / story / reels / video_feeds / search / ig_reels и т.д. |
| `campaign_id/name/objective` | STRING | |
| `adset_id/name` | STRING | |
| `ad_id/name` | STRING | |
| `impressions/clicks` | INT64 | |
| `spend/revenue` | FLOAT64 | |
| `purchases/reach` | INT64 | |

**Расчётные метрики строить в LS:**
- ROAS = `SUM(revenue) / SUM(spend)`
- CTR = `SUM(clicks) / SUM(impressions)`
- CPC = `SUM(spend) / SUM(clicks)`
- CPM = `SUM(spend) / SUM(impressions) * 1000`
- CR = `SUM(purchases) / SUM(clicks) * 100`

---

## Шаги в Looker Studio

### 1. Создать новый Data Source
1. [lookerstudio.google.com](https://lookerstudio.google.com) → **Create** → **Data source**
2. Коннектор: **BigQuery**
3. **Project:** `aurora-scents-494012`
4. **Dataset:** `meta_ads`
5. **Table:** `raw_ad_placements`
6. → **Connect**

### 2. Настроить поля
В редакторе Data Source:
- `date` → тип **Date**
- `spend`, `revenue` → тип **Number**, агрегация **Sum**
- `impressions`, `clicks`, `purchases`, `reach` → тип **Number**, агрегация **Sum**
- Добавить **calculated fields:**
  - `ROAS`: `SUM(revenue) / SUM(spend)` → формат **Number 0.00**
  - `CTR %`: `SUM(clicks) / SUM(impressions) * 100` → формат **Percent 0.00**
  - `CPC`: `SUM(spend) / SUM(clicks)` → формат **Number 0.00**
  - `CPM`: `SUM(spend) / SUM(impressions) * 1000` → формат **Number 0.00**

### 3. Создать новую страницу отчёта
1. В существующем LS-отчёте (или новом) → **Add page**
2. Название: `Placements`
3. Добавить источник данных `raw_ad_placements` (созданный выше)

### 4. Блоки страницы

**А. Фильтры (вверху)**
- Date range control
- Filter controls: `publisher_platform`, `platform_position`, `campaign_name`

**Б. Сводная таблица по площадкам**
- Dimensions: `publisher_platform`, `platform_position`
- Metrics: `spend`, `ROAS`, `purchases`, `revenue`, `impressions`, `CTR %`, `CPC`
- Sorted by: `spend DESC`

**В. График трендов по площадкам**
- Time series chart
- Dimension: `date`
- Breakdown: `publisher_platform`
- Metric: `spend` (или `ROAS`)

**Г. Pie chart — доля spend по platform**
- Dimension: `publisher_platform`
- Metric: `spend`

---

## Дизайн-токены (чтобы совпадало с текущим дашбордом)
- Фон страницы: `#F4F0E6`
- Карточки/таблицы: `#FFFFFF`
- Акцент: `#C9A84C` (gold)
- Шрифт: **DM Sans** / **Cormorant Garamond** для заголовков

---

## Ссылки
- Текущий отчёт LS (если есть) — добавить 2й Data Source и новую страницу
- [BigQuery в Looker Studio — документация](https://support.google.com/looker-studio/answer/6370296)
