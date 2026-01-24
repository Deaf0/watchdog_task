<h1>Watchdog Service</h1>

Watchdog — микросервис, который отслеживает состояние edge-серверов по heartbeat-сообщениям,
поступающим через NATS JetStream, и предоставляет HTTP API для получения списка лучших серверов
по заданной зоне.

<h3>Запуск проекта</h3>
Требования
<ul>
  <li>Docker</li>
  <li>Docker Compose</li>
</ul>
Запуск

```bash
docker compose build  
docker compose up -d postgres nats migrate watchdog
```

Сервис будет доступен на:
http://localhost:3000/best?zone=eu
