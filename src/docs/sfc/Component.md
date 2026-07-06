# Component

`Component` описывает место вложенного SFC/domain component.

```vue
<Component is="flight-status" :flight="flight" />
```

На текущем этапе Vue adapter не создает child runtime host и рендерит placeholder `component:<identity>`. Подключение к `Endge.runtime.execute(child, { parent })` будет отдельным этапом.
