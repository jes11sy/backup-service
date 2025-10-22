# 💾 Backup Service

PostgreSQL automatic backup and restore service with S3 storage integration.

## 🎯 Features

- ✅ **Automated Backups**: Daily, Weekly, Monthly scheduled backups
- ✅ **Manual Backups**: Create backups on-demand via API
- ✅ **S3 Storage**: Upload backups to S3-compatible storage
- ✅ **Restore**: Restore database from any backup
- ✅ **Retention Policy**: Automatic cleanup of old backups
- ✅ **Monitoring**: Track backup history and statistics
- ✅ **API**: RESTful API with Swagger documentation

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Backup Service (5009)           │
├─────────────────────────────────────────┤
│  ┌────────────┐  ┌──────────────┐      │
│  │  Scheduler │→ │ BackupService│      │
│  │  (Cron)    │  │              │      │
│  └────────────┘  └──────┬───────┘      │
│                         │               │
│  ┌──────────────────────┼──────────┐   │
│  │  DatabaseService     │          │   │
│  │  (pg_dump/restore)   │          │   │
│  └──────────────────────┤          │   │
│                         │          │   │
│  ┌──────────────────────┴──────┐   │   │
│  │     S3Service               │   │   │
│  │  (Upload/Download/Delete)   │   │   │
│  └─────────────────────────────┘   │   │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    PostgreSQL            S3 Bucket
    (devcrm)         (devcrm-backups)
```

## 📋 API Endpoints

### Health & Info

```bash
GET  /api/v1/backup/health              # Service health check
GET  /api/v1/backup/database/info       # Database info (version, size, tables)
GET  /api/v1/backup/statistics          # Backup statistics
```

### Backup Management

```bash
POST   /api/v1/backup/create            # Create manual backup
GET    /api/v1/backup/list              # List all backups (with pagination)
GET    /api/v1/backup/:id               # Get backup details
POST   /api/v1/backup/:id/restore       # Restore from backup
DELETE /api/v1/backup/:id               # Delete backup
```

### Schedule Management

```bash
GET  /api/v1/backup/schedule            # Get backup schedules
POST /api/v1/backup/schedule            # Update schedule settings
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- S3-compatible storage (AWS S3, Minio, DigitalOcean Spaces, etc.)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push
```

### Configuration

Create `.env` file:

```env
PORT=5009
DATABASE_URL="postgresql://user:password@host:5432/dbname"

S3_BUCKET_NAME=devcrm-backups
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_key
S3_SECRET_ACCESS_KEY=your_secret
```

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

## 🐳 Docker

### Build

```bash
docker build -t backup-service:latest .
```

### Run

```bash
docker run -d \
  -p 5009:5009 \
  -e DATABASE_URL="postgresql://..." \
  -e S3_ACCESS_KEY_ID="..." \
  -e S3_SECRET_ACCESS_KEY="..." \
  backup-service:latest
```

## ☸️ Kubernetes Deployment

See `k8s/deployments/backup-service-deployment.yaml`

```bash
# Create S3 secret
kubectl create secret generic s3-secret \
  -n backend \
  --from-literal=bucket-name=devcrm-backups \
  --from-literal=region=us-east-1 \
  --from-literal=access-key-id=YOUR_KEY \
  --from-literal=secret-access-key=YOUR_SECRET

# Deploy service
kubectl apply -f k8s/deployments/backup-service-deployment.yaml
```

## 📅 Default Backup Schedule

| Type    | Schedule           | Retention | Description                |
|---------|--------------------|-----------|----------------------------|
| DAILY   | `0 3 * * *`        | 7 days    | Every day at 3:00 AM       |
| WEEKLY  | `0 2 * * 0`        | 30 days   | Every Sunday at 2:00 AM    |
| MONTHLY | `0 1 1 * *`        | 365 days  | 1st of month at 1:00 AM    |

## 📊 Usage Examples

### Create Manual Backup

```bash
curl -X POST https://api.test-shem.ru/api/v1/backup/create \
  -H "Content-Type: application/json" \
  -d '{"type": "MANUAL"}'
```

### List All Backups

```bash
curl https://api.test-shem.ru/api/v1/backup/list?take=10&skip=0
```

### Restore from Backup

```bash
curl -X POST https://api.test-shem.ru/api/v1/backup/{backup-id}/restore
```

### Update Schedule

```bash
curl -X POST https://api.test-shem.ru/api/v1/backup/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DAILY",
    "cronExpression": "0 4 * * *",
    "enabled": true,
    "retentionDays": 14
  }'
```

## 📚 Swagger Documentation

Available at: `http://localhost:5009/api/docs`

## 🔐 Security

- Non-root Docker user
- Environment-based secrets
- Kubernetes secrets for sensitive data
- S3 bucket access control

## 🐛 Troubleshooting

### pg_dump not found

Make sure `postgresql-client` is installed:

```bash
# Alpine Linux
apk add postgresql-client

# Ubuntu/Debian
apt-get install postgresql-client
```

### S3 Upload Failed

Check your S3 credentials and bucket permissions:

```bash
# Test S3 connection
aws s3 ls s3://devcrm-backups --profile your-profile
```

### Backup Too Large

Increase Docker memory limits or adjust timeout settings.

## 📝 Database Schema

The service creates two tables:

- `backup_logs` - History of all backups
- `backup_schedules` - Schedule configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT

## 🔗 Related Services

- [Auth Service](../auth-service)
- [Orders Service](../orders-service)
- [Users Service](../users-service)

---

**Backup Service** - Keep your data safe! 💾🔒

