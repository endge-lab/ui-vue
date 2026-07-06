# Tooltips

`tooltip` является renderer-neutral metadata.

```vue
<Text tooltip="Flight number">{{ flight.number }}</Text>
```

В текущем Vue adapter он мапится в native `title`. Позже этот слой можно заменить на проектный tooltip renderer без изменения IR.
