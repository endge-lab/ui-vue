# DateTime

`DateTime` рендерит дату или время из `value`.

```vue
<DateTime :value="flight.std" format="HH:mm" :timezone="$context.timezone" />
```

Поддержанные форматы v1: `HH:mm`, `date`, default locale datetime.

`timezone` принимает IANA identity (`UTC`, `Europe/Moscow`) или системное
значение `local`, которое использует локальную зону браузера.
