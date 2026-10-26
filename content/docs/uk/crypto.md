---
source: docs/crypto.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: 1713219c9c04cba4db60a95d49dd0d38365ce9026ca10d36ed4d0d602b55f99b
translatedAt: 2026-10-26
---
# Crypto: OpenSSL, збирання та FIPS

`crypto` у Clause реалізує модуль `crypto` з OTP на основі libcrypto з OpenSSL.
Ця довідка описує, яку версію OpenSSL використано та як її знаходять, як Clause
і `clau` збирають її з вихідного коду, як програми компонуються з нею, а також
режим FIPS. Самі вбудовані функції описано в [описі вбудованих функцій](builtins.md#crypto-module),
бібліотечний модуль — у [бібліотеці](library.md), а спостережувані відмінності
від OTP — у [відмінностях](differences.md#crypto).
Операції з ключами та підписами `public_key` викликають його
([public_key](public_key.md#keys-and-signatures)).

## Версії OpenSSL

- **Закріплена: 4.1.0.** Випуск, який Clause завантажує та збирає, якщо іншу
  OpenSSL не задано.
- **Мінімальна: 3.1.2.** Найновіший випуск із валідованим провайдером FIPS
  (сертифікат FIPS 140-3 #4985). Будь-яка libcrypto від 3.1.2 компонується з
  архівом crypto: вбудовані функції використовують лише API з 3.1.2 та враховують
  відмінності версій під час виконання, тому один архів підходить для всіх таких
  libcrypto. Новіші заголовки все ж можуть зіставляти стару назву з новішою
  функцією (`EVP_MD_CTX_get_size` у 4.1 — це `EVP_MD_CTX_get_size_ex` із 3.4),
  тому архів уникає таких назв; повний набір тестів компонує еталонні тести
  crypto з libcrypto, зібраною з вихідного коду 3.1.2.
- **Доступність алгоритмів перевіряється, а не припускається.** Перший виклик
  `crypto` завантажує провайдери (`fips`, якщо його можна завантажити, потім
  `default`, `base` та `legacy`, як в OTP) й отримує кожен алгоритм гешування,
  шифр і MAC із таблиць OTP; `crypto:supports/0,1`, `hash_info/1`, `info/0` та
  `info_lib/0` повідомляють, що надає скомпонована OpenSSL. Програма,
  скомпонована з 3.1.2, просто перелічує менше алгоритмів (без ML-KEM, ML-DSA
  та SLH-DSA).

OpenSSL має ліцензію Apache-2.0; жоден файл OpenSSL не додається до репозиторію.

## Звідки Clause отримує OpenSSL

CMake (`cmake/OpenSSLDependencies.cmake`) визначає libcrypto для архіву crypto
в такому порядку:

1. `-DCLAUSE_OPENSSL_ROOT=<path>`: префікс встановлення
   (`include/openssl/opensslv.h`) або дерево вихідного коду (`Configure`,
   `VERSION.dat`), яке збирається як у пункті 3.
2. Встановлена OpenSSL ≥ 3.1.2 (`CLAUSE_OPENSSL_SYSTEM`, типово ON, крім
   Windows): `find_package(OpenSSL)`, перевага статичній libcrypto.
3. Закріплений випуск, завантажений у `thirdparty/openssl-4.1.0` і перевірений
   (`openssl-4.1.0.tar.gz`, SHA-256
   `50c17baf54cb008f6ce42d50deb4b28050a1aad711636cabd4b241c7e90cc2fd`),
   налаштований та одноразово зібраний у
   `thirdparty/openssl-4.1.0-<arch>-<crt>/install` (перезбирається при зміні
   компілятора чи параметрів); `-DCLAUSE_DOWNLOAD_OPENSSL=OFF` вимикає
   завантаження.

`-DCLAUSE_RUNTIME_CRYPTO=OFF` повністю вилучає архів crypto. Якщо тести
ввімкнено, налаштування також завантажує вихідний код 3.1.2
(`openssl-3.1.2.tar.gz`, SHA-256
`a0ce69b8b97ea6a35b96875235aa453b966ba3cba8af2de23657d8b6767d6539`) у
`thirdparty/openssl-3.1.2` для тестів повного набору;
`-DCLAUSE_TEST_OPENSSL_MINIMUM=OFF` пропускає його та ці тести.

## Збирання OpenSSL із вихідного коду

Збирання з вихідного коду створює статичну libcrypto з вбудованим провайдером
legacy (який вбудовані функції завантажують так само, як OTP):

```
Configure <target> no-shared no-module no-tests no-docs no-makedepend enable-ec_explicit_curves
          [enable-static-vcruntime] [--debug] --prefix=<install> --openssldir=<install>/ssl --libdir=lib
make build_libs && make install_dev
```

- **Компілятор і runtime.** Її збирає компілятор C із CMake (`CC`);
  `enable-static-vcruntime` вибирає `/MT`, коли збирання використовує статичний
  runtime MSVC, а `--debug` — його варіант Debug.
- **Інструменти Windows.** Configure потребує нативного Perl і NASM:
  закріплені портативний Strawberry Perl 5.42.3.1 (SHA-256
  `6a081a811781c30aca51dbc036afd93092af91e3297901f02c17043795a10690`) та
  NASM 3.02 (SHA-256
  `161d0bfaff53c2f9e9f3e69fd0672323ebabafd1268976a5cec11be92a19aee7`)
  завантажуються в `thirdparty/tools/`. Потім `nmake` збирає послідовно
  (одноразово близько 4 хвилин), тому потрібне середовище розробника Visual
  Studio. Linux і macOS використовують свої `perl` та `make -j` (дві третини
  ядер).
- **Старіші дерева вихідного коду отримують лише відомі їм параметри.**
  enable-X і no-X залишаються, коли X є в одному зі списків
  `my @disablables... = (...)` дерева в `Configure`: 3.1.2 не знає ані
  `no-docs`, ані `enable-ec_explicit_curves` (явно задані криві завжди
  включено), ані `enable-static-vcruntime` (її статичні збірки вже
  використовують `/MT`).
- **Кросзбирання** отримують встановлену OpenSSL цільової платформи через
  `CLAUSE_OPENSSL_ROOT`.

### Виявлені підводні камені

- **MSYS Perl із Git порушує роботу Configure.** Він передає Configure шляхи
  Unix, які `nmake` не може використати: збирання у Windows потребує нативного
  Strawberry Perl, а не `perl`, який Git for Windows додає до `PATH`.
- **Збирання поза деревом із `no-apps` завершується помилкою** (немає
  `apps/include`), тому Clause залишає застосунки ввімкненими та збирає ціль
  `build_libs` замість усього.
- **`install_fips` поза деревом завершується помилкою у Windows.** Makefile
  указує програму як `"apps\\openssl.exe"`, що `nmake` не зіставляє зі своїм
  правилом `apps\openssl.exe`. Натомість слід зібрати `build_sw` і самостійно
  виконати `openssl fipsinstall`.
- **3.x встановлює PDB, якого clang-cl ніколи не створює.** Windows-ціль
  `install_dev` статичної збірки 3.x копіює `ossl_static.pdb`, якого вбудована
  налагоджувальна інформація clang-cl (`/Z7`) не створює; Clause надає порожній
  файл (у 4.0 копіювання прибрано).
- **`no-module` вимикає FIPS.** Configure вимикає `fips` за наявності
  `no-module`: провайдер FIPS завжди є окремим модулем, а не частиною статичної
  libcrypto (яка все ж може його завантажити).
- **Статична libcrypto в Linux потребує бібліотек стиснення.** Статична
  `libcrypto.a` в Ubuntu потребує `-lz -lzstd` (`Libs.private` у
  `libcrypto.pc`); потрібні встановленій бібліотеці залежності записуються
  разом із нею.

## Компонування програм

Вбудовані функції містяться у власному архіві `clause_runtime_crypto` поруч із
`clause_runtime`, тому програми, які ніколи не викликають `crypto`, залишаються
такими ж малими; libcrypto зі своїми провайдерами додає близько 4.5 MB тим, що
його викликають.

- **Коли архів компонується.** `clau` компонує архів, коли пакет компіляції
  містить бібліотечний модуль `crypto` (статичний виклик `crypto`), або з
  `--with-crypto` для програм, які звертаються до `crypto` лише через динамічні
  виклики (наприклад, розшифрування налагоджувальної інформації в `beam_lib`).
  Тоді стартовий об'єкт перелічує точку входу розширення архіву, що долучає
  архів, а запуск реєструє його вбудовані функції. Програми без `crypto`
  ніколи не звертаються до OpenSSL.
- **Що компонується.** `clause_runtime_crypto.link` поруч з архівом указує
  libcrypto (перший рядок) та її системні бібліотеки;
  `clause_runtime_crypto.openssl` записує спосіб збирання дерева вихідного коду
  (версію, мінімум, ціль, параметри, компілятор, каталоги Perl і NASM).
- **Інша OpenSSL.** `--with-crypto=PATH`, а за його відсутності змінна
  середовища `CLAUSE_OPENSSL_ROOT`, компонує іншу OpenSSL ≥ 3.1.2: libcrypto
  зі встановлення або дерево вихідного коду, яке `clau` налаштовує та збирає
  за записаним рецептом у `<build-dir>/cache/openssl/<hash>` під час першого
  використання (у Windows — в оболонці розробника Visual Studio для `nmake`).

## FIPS

### Перемикний режим (як в OTP)

Перший виклик `crypto` також намагається завантажити провайдер `fips` із
OpenSSL, який OpenSSL знаходить через власні `OPENSSL_MODULES` (каталог
модулів) і `OPENSSL_CONF` (конфігурацію, що включає `fipsmodule.cnf`, записаний
`openssl fipsinstall`, та активує провайдер). Далі:

- `crypto:enable_fips_mode(true)` вмикає типову властивість OpenSSL
  `fips=yes` (`true`, якщо вдалося, `false` без доступного для завантаження
  провайдера); `crypto:enable_fips_mode(false)` вимикає її.
- `crypto:info_fips/0` повертає `enabled` або `not_enabled`, а
  `not_supported` — коли жодного провайдера FIPS не завантажено.
- `crypto:info/0` додає `fips_provider_buildinfo`, коли завантажено провайдер
  FIPS.
- У режимі FIPS алгоритми, яких немає у провайдера, вилучаються з
  `crypto:supports/1` (як і відкриті ключі та криві OTP, що не належать до FIPS:
  `eddsa`, `eddh`, `srp`, криві Edwards) та спричиняють помилки `notsup` з OTP:
  `"Bad digest type in FIPS"`, `"Digest type not supported in FIPS"`,
  `"MAC algorithm forbidden in FIPS"`, `"Digest algorithm for HMAC forbidden in FIPS"`,
  `"Cipher algorithm not supported in FIPS"`, `"Forbidden in FIPS"`. Кожен
  запис таблиці зберігає другий отриманий алгоритм із `fips=yes`, який
  використовується у ввімкненому режимі FIPS, тож обчислення в цьому режимі
  виконують власні реалізації провайдера.

Операції з відкритими ключами отримують алгоритми через типові властивості
OpenSSL, тому в режимі FIPS використовують реалізації провайдера; `eddsa`
спричиняє `"Unsupported algorithm in FIPS mode"`, а SRP — `notsup`, як в OTP.

Змінна застосунку OTP `fips_mode` не читається (Clause не має `on_load`, а
програми — `sys.config`): програми викликають `crypto:enable_fips_mode/1` або
збираються із закріпленим режимом.

### Програми із закріпленим режимом: `clau --fips=PATH`

`--fips=PATH` збирає програму, яка завжди працює в режимі FIPS із наданим
користувачем провайдером FIPS. `PATH` — це каталог із модулем провайдера та
його `fipsmodule.cnf` або встановлення OpenSSL:

| Файл | Шукається в `PATH`, потім у |
| --- | --- |
| `fips.dll` (Windows), `fips.so` (Linux), `fips.dylib` (macOS) | `lib/ossl-modules`, `lib64/ossl-modules`, `lib/<triplet>/ossl-modules` |
| `fipsmodule.cnf` | `ssl/`, `etc/ssl/` |

- **Збирання завершується помилкою**, коли немає модуля чи файла налаштувань
  або в налаштуваннях немає `module-mac` у секції `[fips_sect]` (слід виконати
  `openssl fipsinstall`).
- **Обидва файли копіюються поруч із виконуваним файлом** під наведеними вище
  назвами; розгортати їх слід разом із ним. Параметр передбачає
  `--with-crypto`; libcrypto вибирається як завжди й має приймати провайдер.
- **До запуску програми** точка входу FIPS стартового об'єкта
  (`CLAUSE_crypto_fips_extension_v1`) читає `fipsmodule.cnf` поруч із
  виконуваним файлом, завантажує сусідній модуль через конфігурацію провайдера
  OpenSSL (налаштування файла плюс `module` і `activate`, які приймає кожна
  libcrypto від 3.0), додатково завантажує лише провайдер `base` з OpenSSL
  (ніколи `default` чи `legacy`; системна конфігурація OpenSSL не читається)
  та вмикає `fips=yes`.
- **Коли провайдер не завантажується** або не проходить самоперевірку
  (змінений модуль, неправильний `module-mac`), програма завершується з кодом
  виходу 70 та `crypto: cannot load the FIPS provider from <directory>: <OpenSSL's error>`
  у stderr. Windows не показує діалог «Bad Image» для пошкодженого модуля:
  під час завантаження ввімкнено тихий режим обробки помилок.
- **Вийти з режиму неможливо.** `crypto:enable_fips_mode(false)` повертає
  `false`, а `crypto:info_fips/0` залишається `enabled`.

### Який провайдер FIPS використовувати

Clause ніколи не збирає провайдер FIPS для розгортання. OpenSSL дозволяє іншим
випускам використовувати валідований провайдер FIPS, але забороняє
використовувати самостійно зібраний провайдер із невалідованого випуску: слід
взяти провайдер валідованого випуску (на час написання — 3.1.2, зібраний за
вимогами його політики безпеки, або наданий постачальником операційної системи)
та виконати його `openssl fipsinstall` на цільовій машині, якщо цього вимагає
політика. Провайдер 3.1.2 завантажується в закріплену libcrypto 4.1: повний
набір тестів збирає його (лише для тесту) та запускає з ним програми із
закріпленим і перемикним режимами.

## Тести

| Тест | Набір | Що перевіряє |
| --- | --- | --- |
| `executables_crypto_digests`, `executables_crypto_ciphers` | fast | Еталони з OTP 29.1.1: вектори, стани, помилки, списки доступних алгоритмів, `info_fips` без провайдера |
| `linking_crypto` | fast | Архів компонується лише за використання; `--with-crypto[=PATH]`, `CLAUSE_OPENSSL_ROOT`, відмови |
| `linking_fips` | fast | Відмови `--fips`, відсутні або некоректні провайдери зривають збирання, копіювання, помилки запуску |
| `linking_crypto_source` | full | `--with-crypto=SOURCE` одноразово збирає дерево 4.1.0 у кеш збирання |
| `linking_crypto_minimum` | full | Еталонні тести crypto, скомпоновані з libcrypto з вихідного коду 3.1.2, виводять свої еталони |
| `linking_fips_real` | full | Провайдер FIPS із 3.1.2 (зібраний з `enable-fips` для тесту) у програмі із закріпленим режимом (залишається в режимі FIPS, заборонені алгоритми, змінений модуль зупиняє її) та з перемикним режимом (`OPENSSL_MODULES`/`OPENSSL_CONF`) |
