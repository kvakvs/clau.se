---
source: docs/parser.md
sourceCommit: 6ed3851c
sourceSha256: 620d520afbba7b5b1d96dcbf60cf55b23bfb6a23153437fd25ee82c424a2afc1
translatedAt: 2026-10-15
---
# Парсер

Розбирає повну граматику OTP 29 з препроцесованих токенів у власне AST.

## CLI

`clau --parse-check -I include -DDEBUG module.erl` виконує препроцесування і
розбір, записуючи діагностику в stderr і нічого не виводячи в stdout у разі
успіху. Застосовуються всі параметри препроцесування. `--print-pp` і
`--print-ast` друкують розгорнутий вихідний код або дерево з того самого
проходу. Параметри шляху виводу в режимах перевірки/друку є помилками
використання. Вхідні файли ізольовані; будь-яка невдача зберігає ненульовий код
виходу. `--` дозволяє шляхи, що починаються з `-`. Коди виходу: 0 — успіх
(попередження дозволені), 1 — помилка вихідного коду/файлової системи, 2 —
помилка використання.

Текст AST використовує об'єкти в дужках, відступ у два пробіли і поля
`name=value`:

```lisp
(Function name=i arity=0 clauses=1
  clause[0]=(FunctionClause arguments=0 guard=none body=1
    body[0]=(IntegerLiteral value=42)
  )
)
```

Принтер ітеративний; після 64 рівнів він обмежує відступ і додає мітки
`[depth=N]`. Текст AST призначений лише для перегляду; зчитувача для нього
немає.

## API

Заголовок `clause/compiler/parser.hpp`, ціль CMake `clause_frontend`:

```cpp
clause::ParseResult load(const std::filesystem::path &path) {
    clause::SourceManager sources;
    clause::PreprocessorSession pp(sources.read(path));
    return clause::parse_module(pp);
}
auto result = load("module.erl"); // Sources and session are gone; AST owns its data.
for (const auto &id : result.module.forms()) {
    const auto &origin = result.module.anchor(result.module.form(id).source);
}
```

- `ast::Module` можна лише переміщувати; він володіє формами, пласкими аренами
  вузлів, буферами вихідного коду і знімками можливостей. Переміщення зберігають
  дескриптори.
- Окремі дескриптори `ExprId`, `PatternSyntaxId`, `TermId`, `TypeId`, `FormId`;
  перевірки власника/покоління відхиляють чужі або застарілі дескриптори.
- `module.visit(id, visitor)` диспетчеризує закритий варіант. Глибокі дерева
  обходьте з явними стеками.
- `NodeSource` — це діапазон розгорнутих токенів плюс якір; використовуйте
  `extent()`/`anchor()`, а не припускайте неперервне фізичне написання.
- Потокова обробка: `ParserSession::consume(event)`,
  `parse_form(tokens, eof, features)`, потім
  `std::move(session).finish(features)`. Завжди перевіряйте
  `ParseResult::failed`; відновлені форми не означають успіху.
- `tests/compiler/parser/consumer.cpp` — скомпільований приклад володіння.

Покриття граматики: атрибути й буквальні терми, кортежні/native records,
оголошення type/opaque/nominal, specs/callbacks, усі вирази, зразки, guard,
клаузи, binary, fun/try/maybe/receive, а також comprehension для списків/map/
binary зі строгими генераторами OTP 29 і zip-групами. Анотації тестів SSA
виключено. Синтаксичний успіх нічого не означає щодо lint, зв'язування чи
генерації коду.

## Відновлення та обмеження

Невдалі форми відкочують арени та джерела походження; пізніші форми лишаються
доступними, але стан невдачі зберігається. Діагностика містить категорію,
логічні координати, трасу макросів/включень, найближчу незакриту відкривну
дужку і термінали `Diagnostic::expected`.

Значення за замовчуванням: 1 000 000 токенів на форму, 4 000 000 токенів на
модуль, 1 000 000 вузлів, 1 000 діагностик (+1 повідомлення про вичерпання),
вкладеність 256 (жорстка межа API — 512), 16 000 000 одиниць роботи. Принтер
дерева за замовчуванням обмежений 4 000 000 відвіданих об'єктів і кидає
`std::length_error` у разі вичерпання. Це межі обліку, а не гарантії за
реальним часом. Вичерпання ресурсів зупиняє сесію.

## Свідчення сумісності

- Усі 344 звичайні продукції `erl_parse.yrl` мають виміряні фікстури-свідки;
  79 продукцій анотацій SSA виключено (`tests/fixtures/parser/phase6/`).
- 43 позитивні фікстури структурно порівнюються з OTP; 183 фікстури
  відхилення, три фікстури винятків builder з OTP (`record_helper`,
  `record_extra`, `any_first`) і `bad.erl` покривають помилки.
- Корпус справжнього вихідного коду (аудит за бажанням): stdlib `lists`, `maps`,
  `sets`, `erl_scan`; compiler `beam_ssa`, `beam_asm` і чотири заголовки, з
  відображеннями `-I`/`--app-dir`, увімкненим `maybe_expr`, вимкненим
  `compr_assign` і `-DCOMPILER_VSN='"parser-compatibility"'`.
- `parser_stress` (ланцюжок із 12 000 операторів), `parser_mutations_0`..`3`
  (шарди по 900 мутацій із зерном, зерно `0x29a016`, запуск двічі) і
  `parser_hardening` обмежують поведінку.
