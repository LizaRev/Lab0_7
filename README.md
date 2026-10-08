### Lab0_7

# Lab0_7

## M1 — Test suite

Для тестування використано Vitest та fast-check.

Перевірено:
- `Vector2` та рух об'єктів;
- зіткнення;
- `World.step` та детермінованість;
- reconciliation;
- token-bucket rate limiter;
- game loop;
- binary codec та protocol.

Додано 5 property-based тестів для codec, випадкових буферів, руху корабля та `parseClientMessage`.

Результат: **98 тестів пройшли успішно**, coverage shared-коду — понад **85%**.

## M2 — E2E та CI

Для E2E використано Playwright.

Перевірено:
- підключення двох гравців до однієї кімнати;
- roster;
- передавання руху;
- чат.

Результат: **3 E2E-тести пройшли успішно**.

GitHub Actions виконує:
`typecheck → lint → unit tests → build → e2e`

CI запускається для `push` та `pull request`.

## M3 — Профілювання та оптимізація

Додано вимірювання `simulate`, `render`, `decode`, `reconcile` та збір frame-time samples.

Для оптимізації:
- додано in-place операції `Vector2`;
- реалізовано pooling `Bullet`;
- binary decode винесено у Web Worker;
- оптимізовано гарячі ділянки `Ship` та `Asteroid`.

Основні перевірки після змін проходять успішно.

## M4 — Bots та load test

Додано серверних ботів `BotAI`, які можуть:
- переслідувати ціль;
- ухилятися;
- стріляти.

Для додавання ботів створено:

`POST /api/rooms/:id/bots`

Також створено Node.js load test на базі `ws`.

### Результати навантаження

| Клієнти | Кімнати | Tick p99 | Event loop | Peak RSS |
|---:|---:|---:|---:|---:|
| 8 | 1 | 5.340 ms | 3.07% | 100.03 MB |
| 32 | 2 | 6.272 ms | 4.95% | 175.30 MB |
| 64 | 4 | 4.279 ms | 6.82% | 171.42 MB |
| 128 | 8 | 3.321 ms | 10.85% | 202.86 MB |

Бюджет server tick при 30 Hz — **33 ms**.

При 128 клієнтах `tick p99 = 3.321 ms`, тому межу продуктивності не досягнуто.

**Зафіксована місткість: ≥128 одночасних клієнтів.**

### Графік tick p99

```mermaid
xychart-beta
    title "Tick p99 залежно від кількості клієнтів"
    x-axis "Клієнти" [8, 32, 64, 128]
    y-axis "Tick p99, ms" 0 --> 35
    line [5.340, 6.272, 4.279, 3.321]




