# 🔒 Security Fix: Scheduler-Only Mode

## ✅ Что изменено

### 1. **backup.controller.ts** - удалены опасные endpoint'ы
- ❌ `POST /create` - удален (используется scheduler)
- ❌ `POST /:id/restore` - удален (слишком опасно)
- ❌ `DELETE /:id` - удален (слишком опасно)
- ❌ `POST /schedule` - удален (настраивается через ENV)

### 2. **backup.scheduler.ts** - конфигурация через ENV
- Теперь читает настройки из переменных окружения
- Можно включать/отключать каждый тип backup'а

### 3. **main.ts** - Swagger только в dev
- Автоматически отключается в production
- Можно контролировать через `SWAGGER_ENABLED`

### 4. **env.example** - пример конфигурации
- Все настройки backup'ов
- Готов к копированию

## 📋 Как использовать

### 1. Скопируйте env.example
```bash
cp env.example .env
# Отредактируйте .env с вашими настройками
```

### 2. Настройте переменные
```env
# Включить/отключить backup'ы
BACKUP_DAILY_ENABLED=true
BACKUP_WEEKLY_ENABLED=true
BACKUP_MONTHLY_ENABLED=false

# Расписание (cron)
BACKUP_DAILY_CRON=0 3 * * *

# Retention (дни)
BACKUP_DAILY_RETENTION=7
```

### 3. Пересоберите и запустите
```bash
npm run build
npm run start:prod
```

## 🛡️ Что теперь безопасно

✅ Нельзя создать backup через API  
✅ Нельзя удалить backup через API  
✅ Нельзя восстановить БД через API  
✅ Нельзя посмотреть список backup'ов через API  
✅ Нельзя узнать структуру БД через API  
✅ Swagger отключен в production  
✅ Только health check (без чувствительной инфы)

**Почему удалены даже read-only endpoint'ы?**
Они раскрывают чувствительную информацию:
- Когда делаются backup'ы (schedule)
- Размер backup'ов (можно угадать размер БД)
- Структуру БД (таблицы, версия PostgreSQL)
- Историю операций

## 🔧 Как мониторить backup'ы

### Вариант 1: kubectl logs
```bash
kubectl logs -n backend -l app=backup-service -f
```

### Вариант 2: kubectl exec
```bash
# Войти в pod
kubectl exec -it -n backend deployment/backup-service -- sh

# Посмотреть последние backup'ы через БД
npx prisma studio
# Или через psql напрямую к БД
```

### Вариант 3: S3 bucket
```bash
aws s3 ls s3://devcrm-backups/daily/
aws s3 ls s3://devcrm-backups/weekly/
aws s3 ls s3://devcrm-backups/monthly/
```

## 🆘 Manual операции (если нужно)

```bash
# Войти в pod
kubectl exec -it -n backend deployment/backup-service -- sh

# Внутри pod'а можно вызвать напрямую:
# 1. Посмотреть список backup'ов
psql $DATABASE_URL -c "SELECT * FROM backup_logs ORDER BY started_at DESC LIMIT 10"

# 2. Создать manual backup (если очень нужно)
# Добавьте в package.json:
# "backup:manual": "node -e \"require('./dist/backup/backup.service').createBackup('MANUAL')\""
npm run backup:manual

# 3. Для restore - ОЧЕНЬ ОСТОРОЖНО!
# Лучше делать вручную через psql
```

## 📊 Доступные endpoint'ы

**Только один публичный endpoint:**

- `GET /api/v1/backup/health` - статус сервиса (ok/error)

**Всё остальное удалено для безопасности.**

