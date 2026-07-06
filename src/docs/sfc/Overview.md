# SFC Renderer

Новый SFC renderer в `@endge/vue` читает готовый `RComponentSFC_IR` и локальные `props`.

На первом этапе renderer не создает runtime host, не читает `Endge.program`, не подписывается на Raph и не управляет repository bindings. Его задача - отрисовать уже скомпилированный IR во Vue `h` tree.

Пример:

```vue
<SFC_Renderer :ir="ir" :props="{ flight, compact: false }" />
```

Поддержанные primitive-теги: `Text`, `DateTime`, `Number`, `Icon`, `Badge`, `Dot`, `Box`, `Flex`, `Divider`, `Component`.
