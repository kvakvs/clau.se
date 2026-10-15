---
source: docs/README.md
sourceCommit: 6ed3851c
sourceSha256: 42d519fef371b8ba151942ea3a92a7ab67b3f1f6aaae2cf1f40c9cc18b5df542
translatedAt: 2026-10-15
---
# Документація Clause

Короткі довідкові нотатки про поточну реалізацію. Кожен файл описує поведінку
та обмеження, які існують сьогодні; плани та історія кроків зберігаються в
`.agents/`.

| Тема | Документ |
| --- | --- |
| Препроцесинг (поведінка `epp`, включення, макроси, можливості) | [preprocessor.md](preprocessor.md) |
| Синтаксичний аналіз, володіння AST, синтаксичні обмеження | [parser.md](parser.md) |
| Проєкти TOML і вибір цілей | [projects.md](projects.md) |
| CLI компілятора, артефакти, LLVM SDK, приклад | [compile.md](compile.md) |
| Точка входу виконуваного файлу, аргументи, код завершення, потоки виведення, компонування | [executables.md](executables.md) |
| Налагоджувальна інформація (`-g`), налагоджувачі й стек викликів Erlang | [debugging.md](debugging.md) |
| Профілювання за запитом (`--profile FILE`): входи й власний час для кожної функції та процесу | [profiling.md](profiling.md) |
| Parse transforms: завантажувач на OTP хоста, обмін abstract format, пошук перетворень | [transforms.md](transforms.md) |
| Семантичний аналіз, типи, виведення типів, зв'язування | [semantic.md](semantic.md) |
| Політика спеціалізації типів | [specialization.md](specialization.md) |
| ABI згенерованого коду: терми, символи, реєстрація, збої, корені | [abi.md](abi.md) |
| Зразки, клаузи та зіставлення в тілі | [patterns.md](patterns.md) |
| Guards і каталог guard BIF | [guards.md](guards.md) |
| Представлення термів (атоми, числа, контейнери, maps, біти, records) і друк | [terms.md](terms.md) |
| Native, кваліфіковані та анонімні records (OTP 29) | [native-records.md](native-records.md) |
| Функціональні значення: `fun F/A`, `fun M:F/A`, виклики funs | [funs.md](funs.md) |
| Робочі вбудовані функції: каталог, мостові виклики, вбудовані funs, реєстрація | [builtins.md](builtins.md) |
| Бібліотечні модулі (підмножини `lists`, `maps`), що компілюються разом із програмами | [library.md](library.md) |
| Консольне виведення: `io:format/1,2`, `io:put_chars/1`, розкладка `~p` | [io.md](io.md) |
| Життєвий цикл runtime, пам'ять, стандартне виведення, сервер коду, облік планувальника | [runtime.md](runtime.md) |
| Процеси: робочі потоки планувальника, кванти часу, `spawn/1,3`, `is_process_alive/1`, зв'язки, сигнали завершення, монітори, зареєстровані імена | [processes.md](processes.md) |
| Порти: ідентичність, таблиця портів, драйвери, режими даних, потік вводу-виводу, стандартний ввід-вивід, файли та сокети (рішення кроку плану step 57A) | [ports.md](ports.md) |
| Контракт купи процесу: розміщення слів, області, допуск, корені, збирання | [runtime-heap.md](runtime-heap.md) |
| Рішення щодо моделі виконання: фрейми, виклики, хвостові виклики, yield, винятки | [execution-model.md](execution-model.md) |
| Звітування про відкладені можливості (`notimpl`) | [features.md](features.md) |
| Прив'язка до джерел OTP і процедура оновлення | [otp-reference.md](otp-reference.md) |
| Відомі відмінності поведінки від Erlang/OTP | [differences.md](differences.md) |
| Базовий рівень валідації, режими тестування, прогалини платформ, історія | [validation.md](validation.md) |

Старіші записи валідації для окремих кроків і JSON-докази стиснуто до
[історії валідації](validation.md#history); повні оригінали залишаються в
історії Git (востаннє присутні в коміті `2777c98`).
