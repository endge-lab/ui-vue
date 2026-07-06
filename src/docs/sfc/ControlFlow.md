# Control Flow

SFC renderer поддерживает control-flow из IR:

- `if`
- `else-if`
- `else`
- `for`

Условия и источники циклов вычисляются локальным evaluator-ом. Сейчас поддержаны literals, dotted path expressions и boolean negation.

```vue
<Flex if="!compact">
  <Text>{{ flight.route }}</Text>
</Flex>

<Text for="item in items">{{ item.name }}</Text>
```
