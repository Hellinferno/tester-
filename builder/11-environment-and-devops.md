# Environment & DevOps

## 1. Environment Strategy

### 1.1 Environment Tiers

| Environment | Purpose | Data | Access | SLA |
|-------------|---------|------|--------|-----|
| **Local** | Development | Synthetic | Developers | N/A |
| **Dev** | Integration testing | Synthetic | Team | Best effort |
| **Staging** | Pre-production | Anonymized production | Team + QA | 99% |
| **Production** | Live users | Real user data | Limited | 99.9% |

### 1.2 Environment Configuration

```yaml
# config/development.yaml
environment: development
debug: true
log_level: DEBUG

services:
 gateway:
 port: 3000
 workers: 2

 input_processor:
 port: 3001
 max_file_size: 50MB

 ocr_service:
 port: 3002
 engines: [tesseract, easyocr]
 cpu_enabled: false

 stt_service:
 port: 3003
 engines: [whisper]
 cpu_enabled: false

 analysis_engine:
 port: 3004
 model: llama-3.1-8b
 cpu_enabled: false # Use CPU for dev

 router_service:
 port: 3005
 openrouter:
 base_url: https://openrouter.ai/api/v1
 timeout: 30s

infrastructure:
 postgres:
 host: localhost
 port: 5432
 database: slm_router_dev

 redis:
 host: localhost
 port: 6379
 db: 0

 minio:
 endpoint: localhost:9000
 bucket: slm-router-dev

 vector_db:
 provider: pinecone
 index: query-embeddings-dev
```

## 2. Infrastructure as Code

### 2.1 Terraform Modules

```hcl
# infra/terraform/modules/eks/main.tf
module "eks" {
 source = "terraform-aws-modules/eks/aws"
 version = "~> 20.0"

 cluster_name = "${var.project_name}-${var.environment}"
 cluster_version = "1.29"

 cluster_endpoint_public_access = true

 vpc_id = var.vpc_id
 subnet_ids = var.private_subnets

 eks_managed_node_groups = {
 general = {
 desired_size = 2
 min_size = 1
 max_size = 5

 instance_types = ["m6i.xlarge"]
 capacity_type = "ON_DEMAND"
 }

 cpu = {
 desired_size = 1
 min_size = 0
 max_size = 3

 instance_types = ["m6i.2xlarge"] # CPU instances for OCR/SLM
 capacity_type = "ON_DEMAND"

 taints = [{
 key = "cpu.com/cpu"
 value = "true"
 effect = "NO_SCHEDULE"
 }]
 }
 }
}
```

### 2.2 Kubernetes Resources

```yaml
# infra/kubernetes/services/analysis-engine/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
 name: analysis-engine
 namespace: slm-router
spec:
 replicas: 2
 selector:
 matchLabels:
 app: analysis-engine
 template:
 metadata:
 labels:
 app: analysis-engine
 spec:
 nodeSelector:
 node-type: cpu
 tolerations:
 - key: cpu.com/cpu
 operator: Equal
 value: "true"
 effect: NoSchedule
 containers:
 - name: analysis-engine
 image: slm-router/analysis-engine:latest
 resources:
 requests:
 memory: "16Gi"
 cpu: "4"
 cpu.com/cpu: 1
 limits:
 memory: "32Gi"
 cpu: "8"
 cpu.com/cpu: 1
 env:
 - name: MODEL_PATH
 value: 
 - name: CPU_MEMORY_UTILIZATION
 value: "0.85"

```

## 3. CI/CD Pipeline

### 3.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
 push:
 branches: [main, develop]
 pull_request:
 branches: [main]

jobs:
 lint-and-format:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - uses: pnpm/action-setup@v2
 - name: Lint & Format
 run: |
 pnpm install
 pnpm lint
 pnpm format:check

 test-python-services:
 runs-on: ubuntu-latest
 strategy:
 matrix:
 service: [input-processor, ocr-service, stt-service, analysis-engine, router-service]
 steps:
 - uses: actions/checkout@v4
 - uses: actions/setup-python@v5
 with:
 python-version: '3.11'
 - name: Test ${{ matrix.service }}
 run: |
 cd services/${{ matrix.service }}
 pip install -r requirements.txt
 pip install -e ../../packages/shared-python
 pytest --cov=src --cov-report=xml
 - uses: codecov/codecov-action@v3
 with:
 files: services/${{ matrix.service }}/coverage.xml

 test-web:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - uses: pnpm/action-setup@v2
 - name: Test Web App
 run: |
 pnpm install
 cd apps/web
 pnpm test

 build-images:
 needs: [lint-and-format, test-python-services, test-web]
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - uses: docker/setup-buildx-action@v3
 - name: Build Images
 run: |
 docker build -t slm-router/gateway:${{ github.sha }} services/gateway
 docker build -t slm-router/analysis-engine:${{ github.sha }} services/analysis-engine
 # ... other services
 - name: Security Scan
 uses: aquasecurity/trivy-action@master
 with:
 image-ref: slm-router/gateway:${{ github.sha }}
 format: 'sarif'
 output: 'trivy-results.sarif'

 deploy-staging:
 needs: build-images
 if: github.ref == 'refs/heads/develop'
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - name: Deploy to Staging
 run: |
 aws eks update-kubeconfig --region us-east-1 --name slm-router-staging
 kubectl set image deployment/gateway gateway=slm-router/gateway:${{ github.sha }} -n slm-router
 # ... update other deployments
```

## 4. Monitoring & Alerting

### 4.1 Prometheus Metrics

```yaml
# prometheus.yml
global:
 scrape_interval: 15s

scrape_configs:
 - job_name: 'gateway'
 static_configs:
 - targets: ['gateway:3000']
 metrics_path: /metrics

 - job_name: 'analysis-engine'
 static_configs:
 - targets: ['analysis-engine:3004']

alerting:
 alertmanagers:
 - static_configs:
 - targets: ['alertmanager:9093']

rule_files:
 - /etc/prometheus/alerts.yml
```

### 4.2 Alert Rules

```yaml
# alerts.yml
groups:
 - name: slm-router-alerts
 rules:
 - alert: HighErrorRate
 expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
 for: 5m
 labels:
 severity: critical
 annotations:
 summary: "High error rate detected"

 - alert: HighLatency
 expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 8
 for: 5m
 labels:
 severity: warning
 annotations:
 summary: "P95 latency exceeds 8 seconds"

 - alert: ModelRoutingAccuracyLow
 expr: routing_accuracy < 0.85
 for: 10m
 labels:
 severity: warning
 annotations:
 summary: "Model routing accuracy below threshold"
```

### 4.3 Grafana Dashboards

- **System Overview**: Request rate, latency, error rate
- **Modality Breakdown**: Usage by input type
- **Model Performance**: Cost, latency, accuracy per model
- **OCR Metrics**: Accuracy, confidence, engine usage
- **STT Metrics**: WER, processing time, engine usage
- **Cost Analysis**: Daily/weekly spend, cost per query

## 5. Logging

### 5.1 Structured Log Format

```json
{
 "timestamp": "2026-07-12T20:27:00Z",
 "level": "INFO",
 "service": "analysis-engine",
 "request_id": "550e8400-e29b-41d4-a716-446655440000",
 "trace_id": "abc123",
 "span_id": "def456",
 "message": "Analysis completed",
 "context": {
 "complexity": "high",
 "subject": "mathematics",
 "latency_ms": 450
 }
}
```

### 5.2 Log Aggregation

```yaml
# Loki configuration
auth_enabled: false

server:
 http_listen_port: 3100

common:
 path_prefix: /loki
 storage:
 filesystem:
 chunks_directory: /loki/chunks
 rules_directory: /loki/rules

schema_config:
 configs:
 - from: 2026-01-01
 store: boltdb-shipper
 object_store: filesystem
 schema: v11
 index:
 prefix: index_
 period: 24h
```

## 6. Backup & Disaster Recovery

### 6.1 Backup Strategy

| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| PostgreSQL | Daily | 30 days | pg_dump + S3 |
| Redis | Hourly | 7 days | RDB snapshots |
| Media Files | Real-time | 90 days | S3 versioning |
| Model Weights | Weekly | 4 copies | S3 + Glacier |

### 6.2 Disaster Recovery

- **RPO (Recovery Point Objective)**: 1 hour
- **RTO (Recovery Time Objective)**: 4 hours
- **Procedure**: Automated failover to standby, restore from latest backup

## 7. Security

### 7.1 Secrets Management

```yaml
# External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
 name: slm-router-secrets
spec:
 refreshInterval: 1h
 secretStoreRef:
 kind: ClusterSecretStore
 name: aws-secrets-manager
 target:
 name: slm-router-secrets
 creationPolicy: Owner
 data:
 - secretKey: OPENROUTER_API_KEY
 remoteRef:
 key: prod/slm-router
 property: openrouter_api_key
 - secretKey: DATABASE_URL
 remoteRef:
 key: prod/slm-router
 property: database_url
```

### 7.2 Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
 name: analysis-engine-policy
spec:
 podSelector:
 matchLabels:
 app: analysis-engine
 policyTypes:
 - Ingress
 - Egress
 ingress:
 - from:
 - podSelector:
 matchLabels:
 app: router-service
 ports:
 - protocol: TCP
 port: 3004
 egress:
 - to:
 - podSelector:
 matchLabels:
 app: redis
 ports:
 - protocol: TCP
 port: 6379
```

---
*Version: 1.0 | Date: 2026-07-12*
