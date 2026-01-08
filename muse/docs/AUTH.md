# Mythos Authentication & Billing Architecture

## Overview

Centralized authentication using **Better Auth** with **Convex** backend, unified billing via **RevenueCat**, self-hosted on **Hetzner** with **Cloudflare** CDN/DNS.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Expo iOS       │  Expo Android   │  Tauri macOS    │  Web                  │
│  (App Store)    │  (Play Store)   │  (Mac App Store)│  (Browser)            │
│  RevenueCat SDK │  RevenueCat SDK │  StoreKit 2     │  N/A                  │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         └─────────────────┴─────────────────┴────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  DNS: cascada.vision → Hetzner IP (Proxied)                         │    │
│  │  DNS: api.cascada.vision → Hetzner IP (Proxied)                     │    │
│  │  SSL: Full (Strict) - Origin cert on Hetzner                        │    │
│  │  WAF: Rate limiting, bot protection                                  │    │
│  │  WebSocket: Enabled (for Convex real-time)                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HETZNER VPS                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Docker Compose Stack                              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │    │
│  │  │ Convex Backend  │  │ Convex Dashboard│  │ Caddy (Reverse  │     │    │
│  │  │ :3210           │  │ :6791           │  │ Proxy + TLS)    │     │    │
│  │  │                 │  │                 │  │ :443            │     │    │
│  │  └────────┬────────┘  └─────────────────┘  └────────┬────────┘     │    │
│  │           │                                         │              │    │
│  │           └─────────────────────────────────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │ Qdrant          │  Vector DB for RAG                                     │
│  │ :6333           │  qdrant.cascada.vision                                 │
│  └─────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ RevenueCat      │  │ Apple/Google    │  │ OpenRouter      │             │
│  │ (Webhooks)      │  │ (OAuth)         │  │ (AI)            │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Hetzner Self-Hosted Setup

### Server Connection

```bash
ssh -i ~/.ssh/hetzner_orchestrator root@78.47.165.136
```

### 1. Server Requirements

- **VPS**: Hetzner CX31 (4 vCPU, 8GB RAM, 80GB SSD)
- **IP**: 78.47.165.136
- **OS**: Ubuntu 22.04 LTS
- **Docker**: 24.0+
- **Domain**: cascada.vision (Cloudflare DNS + Origin Certs)

### 2. Services Overview

| Service | Location | Ports | Domain |
|---------|----------|-------|--------|
| Convex Backend (Cascada) | `/opt/convex-cascada/` | 3220, 3221 | api.cascada.vision |
| Convex Dashboard (Cascada) | `/opt/convex-cascada/` | 6792 | dashboard.cascada.vision |
| Convex Backend (Kora) | `/opt/convex/` | 3210, 3211 | convex.kora.vision |
| Qdrant | `/opt/qdrant/` | 6333 | qdrant.cascada.vision |
| Nginx | System service | 80, 443 | All domains |

### 3. Docker Compose (Cascada)

Located at `/opt/convex-cascada/docker-compose.yml`:

```yaml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    restart: unless-stopped
    ports:
      - "${PORT:-3220}:3210"
      - "${SITE_PROXY_PORT:-3221}:3211"
    volumes:
      - ./convex-data:/convex/data
    env_file:
      - .env
    environment:
      - CONVEX_CLOUD_ORIGIN=${CONVEX_CLOUD_ORIGIN:-https://api.cascada.vision}
      - CONVEX_SITE_ORIGIN=${CONVEX_SITE_ORIGIN:-https://cascada.vision}
      - ACTIONS_USER_TIMEOUT_SECS=300
      - HTTP_SERVER_TIMEOUT_SECONDS=360
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3210/version"]
      interval: 5s
      start_period: 10s

  dashboard:
    image: ghcr.io/get-convex/convex-dashboard:latest
    restart: unless-stopped
    ports:
      - "${DASHBOARD_PORT:-6792}:6791"
    env_file:
      - .env
    environment:
      - PORT=6791
      - NEXT_PUBLIC_DEPLOYMENT_URL=${NEXT_PUBLIC_DEPLOYMENT_URL:-https://api.cascada.vision}
    depends_on:
      backend:
        condition: service_healthy
```

### 4. Cascada Environment

Located at `/opt/convex-cascada/.env`:

```env
CONVEX_CLOUD_ORIGIN=https://api.cascada.vision
CONVEX_SITE_ORIGIN=https://cascada.vision
NEXT_PUBLIC_DEPLOYMENT_URL=https://api.cascada.vision
INSTANCE_NAME=cascada-convex
INSTANCE_SECRET=<generated>
PORT=3220
SITE_PROXY_PORT=3221
DASHBOARD_PORT=6792
```

### 5. Nginx Configuration

Located at `/etc/nginx/sites-available/cascada`:

```nginx
# =============================================================
# Cascada (Mythos) - Convex Backend + Better Auth
# =============================================================

map $http_upgrade $cascada_connection_upgrade {
    default upgrade;
    '' close;
}

# API Backend (Convex API, WebSocket sync, deploy)
server {
    listen 443 ssl http2;
    server_name api.cascada.vision;

    include snippets/cloudflare_real_ip.conf;

    ssl_certificate /etc/ssl/certs/cascada-origin.pem;
    ssl_certificate_key /etc/ssl/private/cascada-origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3220;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $cascada_connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 120s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}

# Site (Better Auth + HTTP Actions)
server {
    listen 443 ssl http2;
    server_name cascada.vision;

    include snippets/cloudflare_real_ip.conf;

    ssl_certificate /etc/ssl/certs/cascada-origin.pem;
    ssl_certificate_key /etc/ssl/private/cascada-origin.key;

    location / {
        proxy_pass http://127.0.0.1:3221;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $cascada_connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Dashboard
server {
    listen 443 ssl http2;
    server_name dashboard.cascada.vision;

    ssl_certificate /etc/ssl/certs/cascada-origin.pem;
    ssl_certificate_key /etc/ssl/private/cascada-origin.key;

    location / {
        proxy_pass http://127.0.0.1:6792;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $cascada_connection_upgrade;
        proxy_set_header Host $host;
    }
}

# HTTP redirects
server {
    listen 80;
    server_name cascada.vision api.cascada.vision dashboard.cascada.vision;
    return 301 https://$host$request_uri;
}
```

### 6. SSL Certificates

Cloudflare Origin Certificates:
- Certificate: `/etc/ssl/certs/cascada-origin.pem`
- Private Key: `/etc/ssl/private/cascada-origin.key`
- Validity: 15 years (until 2041)

### 7. Generate Admin Key

```bash
# SSH into server
ssh -i ~/.ssh/hetzner_orchestrator root@78.47.165.136

# Generate admin key
cd /opt/convex-cascada
docker compose exec backend ./generate_admin_key.sh

# Output: cascada-convex|<64-char-hex>
```

### 8. Deploy Convex Functions

```bash
# On your local machine
cd muse

# Set environment variables
export NODE_TLS_REJECT_UNAUTHORIZED=0  # For Cloudflare origin cert
export CONVEX_SELF_HOSTED_URL=https://api.cascada.vision
export CONVEX_SELF_HOSTED_ADMIN_KEY=cascada-convex|<your-admin-key>

# Deploy
npx convex deploy
```

---

## Cloudflare Configuration

### 1. DNS Records

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | `cascada.vision` | `<hetzner-ip>` | Proxied (orange) | Auto |
| A | `api` | `<hetzner-ip>` | Proxied (orange) | Auto |
| A | `qdrant` | `<hetzner-ip>` | Proxied (orange) | Auto |
| A | `dashboard` | `<hetzner-ip>` | DNS only (gray) | Auto |

### 2. SSL/TLS Settings

1. **SSL/TLS Mode**: Full (Strict)
2. **Origin Certificates**:
   ```bash
   # Generate origin certificate in Cloudflare dashboard
   # SSL/TLS → Origin Server → Create Certificate
   # Download and save to:
   # - /opt/mythos/certs/cascada.vision.pem (certificate)
   # - /opt/mythos/certs/cascada.vision-key.pem (private key)
   ```
3. **Minimum TLS Version**: TLS 1.2
4. **Always Use HTTPS**: On

### 3. Security Settings

**WAF Rules** (Security → WAF):

```
# Rate limit auth endpoints
Rule: (http.request.uri.path contains "/api/auth/")
Action: Rate Limit (100 requests/minute per IP)

# Block known bad bots
Rule: (cf.client.bot)
Action: Block

# Challenge suspicious requests
Rule: (cf.threat_score gt 30)
Action: Managed Challenge
```

**Firewall Rules**:

```
# Allow RevenueCat webhook IPs
Rule: (ip.src in {54.211.85.234 3.213.116.49 34.232.59.213} and http.request.uri.path contains "/webhooks/revenuecat")
Action: Allow

# Block direct IP access
Rule: (not ssl and not cf.edge.server_port eq 443)
Action: Block
```

### 4. Network Settings

- **WebSockets**: Enabled (for Convex real-time sync)
- **gRPC**: Enabled (if using Qdrant gRPC)
- **HTTP/2**: Enabled
- **HTTP/3 (QUIC)**: Enabled

### 5. Caching Rules

```
# Bypass cache for API
Rule: (http.request.uri.path starts_with "/api/")
Cache: Bypass

# Bypass cache for WebSocket
Rule: (http.request.uri.path contains "/sync" or http.request.headers["upgrade"] eq "websocket")
Cache: Bypass

# Cache static assets
Rule: (http.request.uri.path matches "\\.(js|css|png|jpg|ico|woff2)$")
Cache: Cache Everything, Edge TTL: 1 month
```

---

## Better Auth Configuration

### Environment Variables

Set these in Convex:

```bash
# Generate secret
npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Set site URL
npx convex env set SITE_URL=https://cascada.vision

# OAuth providers (optional)
npx convex env set APPLE_CLIENT_ID=<your-apple-client-id>
npx convex env set APPLE_CLIENT_SECRET=<your-apple-client-secret>
npx convex env set GOOGLE_CLIENT_ID=<your-google-client-id>
npx convex env set GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### OAuth Provider Setup

#### Apple Sign In

1. Go to [Apple Developer Console](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. Create a Services ID with identifier: `vision.cascada.mythos.auth`
3. Enable "Sign In with Apple"
4. Add redirect URL: `https://cascada.vision/api/auth/callback/apple`
5. Create a key for Sign In with Apple
6. Generate client secret using the key

#### Google Sign In

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized origins:
   - `https://cascada.vision`
4. Add redirect URIs:
   - `https://cascada.vision/api/auth/callback/google`

---

## RevenueCat Configuration

### 1. Create App in RevenueCat

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Create new project: "Mythos"
3. Add apps:
   - iOS (App Store)
   - Android (Play Store)
   - macOS (Mac App Store)

### 2. Configure Products

Create products in App Store Connect / Google Play Console:

| Product ID | Type | Price |
|------------|------|-------|
| `mythos_pro_monthly` | Auto-renewable | $9.99/month |
| `mythos_pro_yearly` | Auto-renewable | $99.99/year |

### 3. Configure Entitlements

In RevenueCat dashboard:

| Entitlement | Products |
|-------------|----------|
| `pro` | `mythos_pro_monthly`, `mythos_pro_yearly` |

### 4. Configure Webhook

1. Go to Project Settings → Webhooks
2. Add webhook:
   - URL: `https://cascada.vision/webhooks/revenuecat`
   - Authorization: Bearer token (set as `REVENUECAT_WEBHOOK_SECRET`)
   - Events: All

### 5. Get API Keys

```bash
# Set in your .env.local
EXPO_PUBLIC_REVENUECAT_API_KEY=<public-api-key>
REVENUECAT_WEBHOOK_SECRET=<webhook-auth-token>
```

---

## Client Configuration

### Expo (iOS/Android)

```typescript
// apps/expo/src/lib/auth.ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "https://cascada.vision",
  plugins: [
    expoClient({
      scheme: "mythos",
      storage: SecureStore,
    }),
  ],
});
```

### Tauri (macOS)

```typescript
// apps/tauri/src/lib/auth.ts
import { createAuthClient } from "better-auth/react";
import { crossDomainClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "https://cascada.vision",
  plugins: [crossDomainClient()],
});
```

### Deep Link Configuration

**Expo** (`app.json`):
```json
{
  "scheme": "mythos"
}
```

**Tauri** (`tauri.conf.json`):
```json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["mythos"]
      }
    }
  }
}
```

---

## Auth Flow

### Email/Password Sign In

```
Client                Better Auth              Convex DB
  │                       │                        │
  │  POST /api/auth/      │                        │
  │  sign-in/email        │                        │
  │──────────────────────▶│                        │
  │                       │  Query user            │
  │                       │───────────────────────▶│
  │                       │◀───────────────────────│
  │                       │  Verify password       │
  │                       │  Create session        │
  │                       │───────────────────────▶│
  │  Set-Cookie: session  │◀───────────────────────│
  │◀──────────────────────│                        │
```

### OAuth Sign In (Apple/Google)

```
Client              Better Auth         OAuth Provider        Convex DB
  │                     │                     │                   │
  │  signIn.social()    │                     │                   │
  │────────────────────▶│                     │                   │
  │                     │  Redirect to OAuth  │                   │
  │◀────────────────────│                     │                   │
  │                     │                     │                   │
  │  User authenticates │                     │                   │
  │────────────────────────────────────────▶  │                   │
  │                     │  Callback with code │                   │
  │  mythos://auth/     │◀────────────────────│                   │
  │  callback?code=...  │                     │                   │
  │────────────────────▶│                     │                   │
  │                     │  Exchange code      │                   │
  │                     │────────────────────▶│                   │
  │                     │  Access token       │                   │
  │                     │◀────────────────────│                   │
  │                     │  Create/update user │                   │
  │                     │────────────────────────────────────────▶│
  │  Session cookie     │◀────────────────────────────────────────│
  │◀────────────────────│                     │                   │
```

### RevenueCat Subscription Flow

```
Client            App Store         RevenueCat          Convex
  │                   │                  │                 │
  │  Purchase         │                  │                 │
  │──────────────────▶│                  │                 │
  │                   │  Verify receipt  │                 │
  │                   │─────────────────▶│                 │
  │                   │                  │  Webhook        │
  │                   │                  │  INITIAL_PURCHASE│
  │                   │                  │────────────────▶│
  │                   │                  │                 │  Update
  │                   │                  │                 │  subscription
  │  CustomerInfo     │                  │                 │
  │◀──────────────────│                  │                 │
  │                   │                  │                 │
  │  Sync entitlements│                  │                 │
  │─────────────────────────────────────────────────────▶ │
```

---

## Security Checklist

### Server Security

- [ ] SSH key-only authentication (disable password)
- [ ] UFW firewall (allow only 80, 443, 22)
- [ ] Fail2ban for SSH protection
- [ ] Automatic security updates (`unattended-upgrades`)
- [ ] Docker rootless mode (optional)

### Application Security

- [ ] BETTER_AUTH_SECRET is cryptographically random (32+ bytes)
- [ ] All secrets stored in Convex env, not in code
- [ ] HTTPS enforced everywhere
- [ ] CORS properly configured for trusted origins only
- [ ] Rate limiting on auth endpoints
- [ ] Webhook signatures verified

### Cloudflare Security

- [ ] SSL/TLS set to Full (Strict)
- [ ] WAF enabled with managed rules
- [ ] Bot protection enabled
- [ ] DDoS protection active (automatic)
- [ ] Origin IP hidden (no direct access)

---

## Monitoring & Debugging

### Health Checks

```bash
# Check Convex health
curl https://api.cascada.vision/health

# Check auth endpoint
curl https://cascada.vision/api/auth/session

# Check webhook endpoint
curl -X POST https://cascada.vision/webhooks/revenuecat \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"event":{"type":"TEST"}}'
```

### Logs

```bash
# Docker logs on Hetzner
docker compose logs -f convex
docker compose logs -f caddy

# Convex dashboard
open https://dashboard.cascada.vision
```

### Common Issues

| Issue | Solution |
|-------|----------|
| WebSocket not connecting | Enable WebSocket in Cloudflare |
| OAuth redirect failing | Check `trustedOrigins` in Better Auth config |
| Webhook 401 | Verify `REVENUECAT_WEBHOOK_SECRET` matches |
| CORS errors | Check CSP in `tauri.conf.json` and Caddy headers |
| Session not persisting | Check cookie settings and `sameSite` policy |

---

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| Hetzner CX31 | ~€10 |
| Cloudflare Pro (optional) | $20 |
| RevenueCat | Free (up to $2.5k/month) |
| Domain | ~$15/year |
| **Total** | **~€10-30/month** |
