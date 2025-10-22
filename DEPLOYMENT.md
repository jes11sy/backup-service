# 🚀 Deployment Guide: Backup Service

## 📋 Prerequisites

- [x] Kubernetes cluster running
- [x] Backend namespace created (`backend`)
- [x] Database secret configured
- [x] Docker Hub account (jes11sy)
- [x] S3 bucket created (or S3-compatible storage)

---

## 🔑 Step 1: Create S3 Secret

```bash
kubectl create secret generic s3-secret \
  -n backend \
  --from-literal=bucket-name=devcrm-backups \
  --from-literal=region=us-east-1 \
  --from-literal=access-key-id=YOUR_ACCESS_KEY_ID \
  --from-literal=secret-access-key=YOUR_SECRET_ACCESS_KEY \
  --from-literal=endpoint=""
```

**Verify:**
```bash
kubectl get secret s3-secret -n backend
```

---

## 🐳 Step 2: Build and Push Docker Image

### Option A: Manual Build

```bash
cd api-services/backup-service

# Build image
docker build -t jes11sy/backup-service:latest .

# Push to Docker Hub
docker push jes11sy/backup-service:latest
```

### Option B: GitHub Actions (Recommended)

1. Create GitHub repository: `https://github.com/YOUR_USERNAME/backup-service`

2. Add secrets to repository:
   - `DOCKER_USERNAME`: jes11sy
   - `DOCKER_PASSWORD`: your_docker_hub_token

3. Push code:
```bash
cd api-services/backup-service
git init
git add .
git commit -m "Initial commit: Backup Service"
git remote add origin https://github.com/YOUR_USERNAME/backup-service.git
git push -u origin main
```

GitHub Actions will automatically build and push the image.

---

## ☸️ Step 3: Deploy to Kubernetes

```bash
# Deploy backup service
kubectl apply -f k8s/deployments/backup-service-deployment.yaml

# Update ingress (already done in backend-ingress.yaml)
kubectl apply -f k8s/ingress/backend-ingress.yaml
```

**Verify deployment:**
```bash
# Check pods
kubectl get pods -n backend -l app=backup-service

# Check service
kubectl get svc -n backend -l app=backup-service

# Check logs
kubectl logs -n backend -l app=backup-service -f
```

---

## 🧪 Step 4: Test the Service

### 4.1 Health Check

```bash
curl https://api.test-shem.ru/api/v1/backup/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-22T...",
  "database": "connected"
}
```

### 4.2 Database Info

```bash
curl https://api.test-shem.ru/api/v1/backup/database/info
```

### 4.3 Get Schedules

```bash
curl https://api.test-shem.ru/api/v1/backup/schedule
```

### 4.4 Create Manual Backup

```bash
curl -X POST https://api.test-shem.ru/api/v1/backup/create \
  -H "Content-Type: application/json" \
  -d '{"type": "MANUAL"}'
```

### 4.5 List Backups

```bash
curl https://api.test-shem.ru/api/v1/backup/list
```

---

## 📊 Step 5: Monitor

### View Logs

```bash
# Real-time logs
kubectl logs -n backend -l app=backup-service -f

# Last 100 lines
kubectl logs -n backend -l app=backup-service --tail=100
```

### Check Backup Execution

```bash
# Inside the pod
kubectl exec -it -n backend deployment/backup-service -- sh

# Check backup files
ls -lah /tmp/backups/
```

### Check S3 Bucket

```bash
# Using AWS CLI
aws s3 ls s3://devcrm-backups/daily/
aws s3 ls s3://devcrm-backups/weekly/
aws s3 ls s3://devcrm-backups/monthly/
```

---

## 🔄 Step 6: Configure Schedules (Optional)

Default schedules are created automatically:
- **DAILY**: Every day at 3:00 AM (retention: 7 days)
- **WEEKLY**: Every Sunday at 2:00 AM (retention: 30 days)
- **MONTHLY**: 1st of month at 1:00 AM (retention: 365 days)

To customize:

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

---

## 🔧 Troubleshooting

### Issue: Pod Not Starting

```bash
kubectl describe pod -n backend -l app=backup-service
```

Common causes:
- S3 secret not created
- Database secret not configured
- Image pull error

### Issue: Backup Failed

```bash
# Check logs
kubectl logs -n backend -l app=backup-service --tail=200

# Common issues:
# 1. pg_dump not found → Check Dockerfile
# 2. S3 permission denied → Check S3 credentials
# 3. Disk space → Check volume size
```

### Issue: pg_dump Timeout

Increase timeout in DatabaseService or add more resources:

```yaml
resources:
  limits:
    cpu: "2000m"  # Increase from 1000m
    memory: "2Gi" # Increase from 1Gi
```

### Issue: S3 Connection Failed

Verify S3 credentials:

```bash
kubectl exec -it -n backend deployment/backup-service -- sh

# Test AWS CLI (if available)
aws s3 ls --endpoint-url=$S3_ENDPOINT
```

---

## 🔐 Security Checklist

- [x] S3 credentials stored in Kubernetes Secret
- [x] Database URL stored in Kubernetes Secret
- [x] Non-root Docker user
- [x] S3 bucket with restricted access
- [x] HTTPS-only access via Ingress

---

## 📈 Monitoring & Alerts (Optional)

### Prometheus Metrics (Future Enhancement)

Add metrics endpoint for monitoring:
- Backup success/failure rate
- Backup size over time
- S3 upload duration
- Database connection status

### Email/Telegram Alerts (Future Enhancement)

Configure notifications for:
- Backup failures
- Large backup sizes
- Retention policy violations

---

## 🎯 Next Steps

1. ✅ Service deployed
2. 🔄 Monitor first scheduled backup (next 3:00 AM)
3. 🧪 Test restore functionality
4. 📊 Set up monitoring dashboard (optional)
5. 🔔 Configure alerts (optional)

---

## 📚 API Documentation

Swagger UI available at:
```
https://api.test-shem.ru/api/docs
```

Or access locally:
```bash
kubectl port-forward -n backend svc/backup-service 5009:5009
# Open http://localhost:5009/api/docs
```

---

## 🆘 Support

If you encounter issues:

1. Check logs: `kubectl logs -n backend -l app=backup-service`
2. Check pod status: `kubectl describe pod -n backend -l app=backup-service`
3. Verify secrets: `kubectl get secrets -n backend`
4. Test S3 access manually
5. Review README.md for common issues

---

**Deployment Time:** ~5-10 minutes  
**Status:** Ready for Production 🚀

