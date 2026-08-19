# Tooltips

`tooltip` — сокращённая renderer-neutral форма текстового тултипа:

```vue
<Text tooltip="Flight number">{{ flight.number }}</Text>
```

Полная форма поддерживает текст, безопасный Markdown и лениво создаваемую SFC-разметку:

```vue
<Tooltip text="Flight number" side="right" align="start" :open-delay="250">
  <Text>{{ flight.number }}</Text>
</Tooltip>

<Tooltip markdown="**Delayed** until `14:30`">
  <Badge>Delayed</Badge>
</Tooltip>

<Tooltip>
  <TooltipTrigger><Icon name="info" /></TooltipTrigger>
  <TooltipContent>
    <Flex direction="column" gap="2">
      <Text weight="semibold">Flight details</Text>
      <Badge>{{ flight.status }}</Badge>
    </Flex>
  </TooltipContent>
</Tooltip>
```

Vue adapter не создаёт native `title`. Все три Vue-адаптера подключаются к единственному Shell-scoped менеджеру; содержимое вычисляется и монтируется только после задержки открытия. Полная пользовательская документация находится в разделе `Компоненты / Tooltip` репозитория документации.
