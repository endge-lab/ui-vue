# Styles

SFC renderer применяет renderer-neutral style props как inline style metadata.

Поддержанные базовые props:

- `p`, `pt`, `pr`, `pb`, `pl`
- `m`, `mt`, `mr`, `mb`, `ml`
- `color`, `bg`
- `w`, `h`, `minW`, `minH`, `maxW`, `maxH`

Числовые spacing values умножаются на `4px`, чтобы совпадать с текущей SFC шкалой.
