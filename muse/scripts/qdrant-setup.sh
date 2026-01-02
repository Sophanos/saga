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
echo "✅ saga_vectors setup complete!"
echo ""

# ============================================
# SAGA_IMAGES - CLIP Embeddings (512 dims)
# ============================================
IMAGES_COLLECTION="saga_images"

echo "🖼️  Setting up Qdrant collection: $IMAGES_COLLECTION"
echo "   Model: clip-ViT-B-32-multilingual-v1 (512 dimensions)"

# Create saga_images collection
curl -X PUT "$QDRANT_URL/collections/$IMAGES_COLLECTION" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{
    "vectors": {
      "size": 512,
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
      "wal_capacity_mb": 32
    }
  }'

echo ""
echo "📇 Creating payload indexes for $IMAGES_COLLECTION..."

# Index: project_id (all queries filter by project)
curl -X PUT "$QDRANT_URL/collections/$IMAGES_COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "project_id", "field_schema": "keyword"}'

# Index: asset_id (for deduplication)
curl -X PUT "$QDRANT_URL/collections/$IMAGES_COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "asset_id", "field_schema": "keyword"}'

# Index: entity_id (for entity portraits)
curl -X PUT "$QDRANT_URL/collections/$IMAGES_COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "entity_id", "field_schema": "keyword"}'

# Index: image_type (portrait, scene, item, etc.)
curl -X PUT "$QDRANT_URL/collections/$IMAGES_COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "image_type", "field_schema": "keyword"}'

# Index: created_at_ts (for recency sorting)
curl -X PUT "$QDRANT_URL/collections/$IMAGES_COLLECTION/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "created_at_ts", "field_schema": "integer"}'

echo ""
echo "✅ saga_images setup complete!"
echo ""

# ============================================
# Verify both collections
# ============================================
echo "📊 Collection info:"
echo ""
echo "saga_vectors:"
curl -s "$QDRANT_URL/collections/$COLLECTION" \
  -H "api-key: $QDRANT_API_KEY" | jq '.result | {status, vectors_count, points_count, indexed_vectors_count}'

echo ""
echo "saga_images:"
curl -s "$QDRANT_URL/collections/$IMAGES_COLLECTION" \
  -H "api-key: $QDRANT_API_KEY" | jq '.result | {status, vectors_count, points_count, indexed_vectors_count}'
