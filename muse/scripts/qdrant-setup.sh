#!/bin/bash
# Qdrant Collection Setup Script for Hetzner
# Run after Qdrant is installed: ./scripts/qdrant-setup.sh

QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
QDRANT_API_KEY="${QDRANT_API_KEY}"
COLLECTION="saga_vectors"

echo "🔧 Setting up Qdrant collection: $COLLECTION"
echo "   URL: $QDRANT_URL"

# Create collection with optimized settings
curl -X PUT "$QDRANT_URL/collections/$COLLECTION" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{
    "vectors": {
      "size": 4096,
      "distance": "Cosine",
      "on_disk": true
    },
    "optimizers_config": {
      "indexing_threshold": 10000,
      "memmap_threshold": 50000
    },
    "hnsw_config": {
      "m": 16,
      "ef_construct": 100,
      "on_disk": true
    },
    "wal_config": {
      "wal_capacity_mb": 64
    }
  }'

echo ""
echo "📇 Creating payload indexes..."

# Index: type (document, entity, memory)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "type", "field_schema": "keyword"}'

# Index: project_id (all queries filter by project)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "project_id", "field_schema": "keyword"}'

# Index: category (for memory filtering)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "category", "field_schema": "keyword"}'

# Index: scope (for memory filtering)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "scope", "field_schema": "keyword"}'

# Index: owner_id (for user-scoped memories)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "owner_id", "field_schema": "keyword"}'

# Index: conversation_id (for session memories)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "conversation_id", "field_schema": "keyword"}'

# Index: entity_type (for entity filtering)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "entity_type", "field_schema": "keyword"}'

# Index: created_at_ts (for range queries, TTL)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "created_at_ts", "field_schema": "integer"}'

# Index: expires_at_ts (for TTL filtering)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "expires_at_ts", "field_schema": "integer"}'

echo ""
echo "✅ Collection setup complete!"
echo ""

# Verify
echo "📊 Collection info:"
curl -s "$QDRANT_URL/collections/$COLLECTION" \
  -H "api-key: $QDRANT_API_KEY" | jq '.result | {status, vectors_count, points_count, indexed_vectors_count}'
