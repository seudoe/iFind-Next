# Phase 6 Testing Guide

## Overview
Phase 6 implements an event-driven recommendation system with HNSW indexing, caching, and monitoring. This guide helps verify all components are working correctly.

---

## 1. Metrics Monitoring

### Check Current Metrics
```bash
# Get current metrics snapshot (admin only)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/monitoring/metrics
```

**Expected Response:**
```json
{
  "success": true,
  "metrics": {
    "avgGenerationTime": 150.5,
    "maxGenerationTime": 250,
    "minGenerationTime": 100,
    "totalGenerations": 42,
    "avgSearchLatency": 45.2,
    "maxSearchLatency": 80,
    "minSearchLatency": 20,
    "totalSearches": 42,
    "cacheHits": 28,
    "cacheMisses": 14,
    "cacheHitRatio": 66.67,
    "cacheMissRatio": 33.33,
    "avgRefreshDuration": 5000.5,
    "totalRefreshes": 3,
    "lastRefreshAt": "2026-08-06T12:00:00Z",
    "indexSize": 2048000,
    "indexVectorCount": 150,
    "timestamp": "2026-08-06T12:15:00Z"
  }
}
```

### Reset Metrics
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/monitoring/metrics
```

**What to verify:**
- ✅ Generation time increases with cache misses
- ✅ Cache hit ratio improves after repeated requests
- ✅ Search latency stays low (< 100ms)
- ✅ Index size matches HNSW file size

---

## 2. HNSW Index and Internship Events

### Test 1: Add New Internship via Vectorize API

**Step 1:** Get an internship ID that doesn't have vectors yet
```bash
# In MongoDB, find internship without vectors
db.internships.findOne({ tfidf_vector: { $exists: false } })
```

**Step 2:** Call vectorize endpoint
```bash
curl -X POST -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["<internship_id>"]}' \
  http://localhost:3000/api/admin/vectorize
```

**Expected Response:**
```json
{
  "success": true,
  "vectorized": 1,
  "skipped": 0,
  "indexInserted": 1,
  "message": "Internships vectorized and inserted into HNSW index. Recommendations will be generated lazily on user request."
}
```

**What to verify:**
- ✅ Response shows `indexInserted: 1`
- ✅ No errors in console
- ✅ HNSW index file updated (check file modification time)

**Step 3:** Verify in MongoDB
```javascript
// Check internship has vectors
db.internships.findOne({ _id: ObjectId("<internship_id>") }, 
  { tfidf_vector: 1, bert_vector: 1 })
```

**Expected:** Both `tfidf_vector` and `bert_vector` are arrays

### Test 2: Verify HNSW Index Contains Vector

**Step 1:** Check index statistics
```bash
# In Node.js repl or test file
const { HNSWIndexManager } = require('./lib/hnsw/HNSWIndexManager');
const manager = new HNSWIndexManager('./data/hnsw/internships', {});
const stats = await manager.getStats();
console.log(stats);
```

**Expected:**
```javascript
{
  vectorCount: 150,  // Should have increased
  dimensions: 768,
  sizeInBytes: 2048000,
  lastUpdated: Date
}
```

**What to verify:**
- ✅ `vectorCount` increased after adding internship
- ✅ `sizeInBytes` updated
- ✅ Index file exists at `./data/hnsw/internships`

---

## 3. Cache System

### Test 1: Generate Recommendations and Check Cache

**Step 1:** Get user ID with resume vectors
```bash
# In MongoDB
db.users.findOne(
  { "resume.tfidf_vector": { $exists: true } },
  { _id: 1 }
)
```

**Step 2:** Request recommendations (triggers generation)
```bash
curl -H "Authorization: Bearer <user_token>" \
  http://localhost:3000/api/internships/recommended
```

**Expected Response:**
- First request: `"cached": false` in metadata
- Cache hit message in logs: `✅ Cache hit for user <userId>`

**Step 3:** Request same recommendations again
```bash
curl -H "Authorization: Bearer <user_token>" \
  http://localhost:3000/api/internships/recommended
```

**Expected:**
- Second request should be instant
- Logs show: `✅ Cache hit for user <userId>`
- Metrics show increased `cacheHits`

**What to verify:**
- ✅ First request slower (generation)
- ✅ Second request faster (cache)
- ✅ Same recommendations returned
- ✅ Cache hit ratio increases

### Test 2: Cache Invalidation on Resume Update

**Step 1:** Note current cache hit count
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/monitoring/metrics
# Record cacheHits value
```

**Step 2:** Update user resume
```bash
curl -X PUT -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{"driveViewLink": "https://drive.google.com/..."}' \
  http://localhost:3000/api/user/resume
```

**Expected Response:**
- Success response
- Logs show: `🗑️ Invalidating cache for user <userId>`

**Step 3:** Request recommendations
```bash
curl -H "Authorization: Bearer <user_token>" \
  http://localhost:3000/api/internships/recommended
```

**Expected:**
- Cache miss (logs show: `⚠️ Cache miss for user <userId>, generating recommendations...`)
- Slower response (regenerating)
- Metrics show new cache miss

**What to verify:**
- ✅ Cache invalidated after resume update
- ✅ Recommendations regenerated
- ✅ `cacheMisses` count increased

---

## 4. Background Refresh Service

### Test 1: Manual Trigger

**Step 1:** Reset metrics
```bash
curl -X POST -H "Authorization: Bearer <admin_token>" \
  http://localhost:3000/api/monitoring/metrics
```

**Step 2:** Run background refresh
```bash
curl -H "Authorization: Bearer <cron_secret>" \
  http://localhost:3000/api/cron/refresh-recommendations
```

**Expected Response:**
```json
{
  "success": true,
  "result": {
    "processed": 42,
    "refreshed": 28,
    "skipped": 14,
    "errors": 0,
    "durationMs": 5432,
    "message": null
  }
}
```

**What to verify:**
- ✅ `refreshed > 0` (some users cached)
- ✅ `errors === 0` (no failures)
- ✅ `durationMs` reasonable (< 60s for small dataset)
- ✅ Logs show batch processing progress

### Test 2: Verify Only Active Users Refreshed

**Step 1:** Check MongoDB for recently active users
```javascript
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

db.users.countDocuments({
  lastLoginAt: { $gte: sevenDaysAgo },
  "resume.tfidf_vector": { $exists: true },
  $or: [
    { recommendedUpdatedAt: { $exists: false } },
    { recommendedUpdatedAt: { $lt: new Date(Date.now() - 23 * 60 * 60 * 1000) } }
  ]
})
```

**Step 2:** Compare with refresh result
```bash
curl -H "Authorization: Bearer <cron_secret>" \
  http://localhost:3000/api/cron/refresh-recommendations

# Result should show similar "processed" count
```

**What to verify:**
- ✅ Only recently active users processed
- ✅ Inactive users skipped
- ✅ Count matches MongoDB query

### Test 3: Custom Refresh Config

```bash
# Refresh users active within 14 days, batch size 100
curl "http://localhost:3000/api/cron/refresh-recommendations?activeWithinDays=14&batchSize=100" \
  -H "Authorization: Bearer <cron_secret>"

# Refresh only first 500 users
curl "http://localhost:3000/api/cron/refresh-recommendations?maxUsers=500" \
  -H "Authorization: Bearer <cron_secret>"
```

**What to verify:**
- ✅ Different `activeWithinDays` changes user selection
- ✅ `maxUsers` limits processing
- ✅ `batchSize` affects progress logs

---

## 5. Event-Driven System

### Test 1: Internship Expiration Event

**Step 1:** Get an active internship
```javascript
db.internships.findOne({ isActive: true })
```

**Step 2:** Manually trigger expiration (simulating admin action)
```bash
# Update internship in MongoDB to mark as inactive
db.internships.updateOne(
  { _id: ObjectId("<internship_id>") },
  { $set: { isActive: false } }
)
```

**Step 3:** In your application code, trigger event handler
```javascript
import { onInternshipExpired } from '@/lib/recommendation/events';
await onInternshipExpired('<internship_id>');
```

**Expected Logs:**
```
🗑️  Event: Internship expired (<internship_id>)
✅ Internship <internship_id> removed from HNSW index
✅ Event completed: Internship expired (<internship_id>)
```

**What to verify:**
- ✅ Event handler executes
- ✅ HNSW index vector count decreases
- ✅ Index file updated

---

## 6. End-to-End Flow

### Complete Test Scenario

**Setup:**
1. Admin vectorizes 5 new internships
2. User requests recommendations (first time)
3. User requests recommendations again (cache hit)
4. User updates resume
5. User requests recommendations (cache miss, regenerate)
6. Background refresh runs for active users
7. Check metrics for all activity

**Step 1: Vectorize Internships**
```bash
curl -X POST -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["id1", "id2", "id3", "id4", "id5"]}' \
  http://localhost:3000/api/admin/vectorize
```
✅ Expect: `vectorized: 5, indexInserted: 5`

**Step 2: First Recommendation Request**
```bash
curl -H "Authorization: Bearer <user_token>" \
  http://localhost:3000/api/internships/recommended
```
✅ Expect: Slower response, `cached: false`

**Step 3: Second Recommendation Request**
```bash
curl -H "Authorization: Bearer <user_token>" \
  http://localhost:3000/api/internships/recommended
```
✅ Expect: Instant response, same recommendations

**Step 4: Update Resume**
```bash
curl -X PUT -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{"driveViewLink": "https://..."}' \
  http://localhost:3000/api/user/resume
```
✅ Expect: Cache invalidation message

**Step 5: Recommendation Request After Resume Update**
```bash
curl -H "Authorization: Bearer <user_token>" \
  http://localhost:3000/api/internships/recommended
```
✅ Expect: Cache miss, regeneration, possibly different recommendations

**Step 6: Check Metrics**
```bash
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3000/api/monitoring/metrics
```
✅ Expected Metrics:
- `totalGenerations: 2` (first request + after resume update)
- `cacheHits: 1` (second request)
- `cacheMisses: 2` (first request + after update)
- `cacheHitRatio: 33.33%`
- `indexVectorCount: 5+` (new internships)

---

## 7. Console Logging Verification

Watch console logs during testing for key messages:

### Cache Operations
```
✅ Cache hit for user <userId>
⚠️ Cache miss for user <userId>, generating recommendations...
🗑️ Invalidating cache for user <userId>
```

### HNSW Operations
```
📦 Building in-memory HNSW index from X candidates...
✅ Internship <id> inserted into HNSW index
📊 Recording HNSW search latency: XXms
```

### Recommendations
```
🔄 Recommendation generation: XXms
📊 Top N recommendations: 20
```

### Background Refresh
```
🔄 Starting background refresh...
📋 Found X users to refresh
✅ Refreshed recommendations for user <userId>
✅ Background refresh completed
```

---

## 8. Performance Benchmarks

Expected performance metrics:

| Operation | Time | Notes |
|-----------|------|-------|
| First recommendation generation | 200-500ms | Depends on candidate count |
| Cache hit (retrieval) | 5-20ms | Sub-50ms optimal |
| HNSW search (K=100) | 30-80ms | Fast approximate search |
| Cache invalidation | < 10ms | Instant |
| Background refresh (100 users) | 3-10s | Batch processing |
| Metrics endpoint response | 5-20ms | In-memory snapshot |

---

## 9. Debugging Checklist

If something isn't working:

### Metrics Show Zero Values
- [ ] Check if `/api/internships/recommended` is being called
- [ ] Verify request has valid auth token
- [ ] Check browser/client logs for errors

### Cache Not Working
- [ ] Verify MongoDB is running
- [ ] Check `recommendedUpdatedAt` in user document
- [ ] Ensure cache TTL hasn't expired (24 hours default)
- [ ] Check logs for cache invalidation triggers

### HNSW Index Empty
- [ ] Run vectorize endpoint for at least one internship
- [ ] Check `./data/hnsw/internships` directory exists
- [ ] Verify internship has both `tfidf_vector` and `bert_vector`

### Background Refresh Not Working
- [ ] Verify `CRON_SECRET` env var matches request header
- [ ] Check if users have `lastLoginAt` within threshold
- [ ] Ensure users have `resume.tfidf_vector` and `resume.bert_vector`
- [ ] Check for MongoDB connection errors

### High Latency
- [ ] Check if HNSW index is loaded (should be cached)
- [ ] Monitor CPU usage during search
- [ ] Check K parameter (higher K = slower but more accurate)
- [ ] Verify network latency to MongoDB

---

## 10. Quick Test Commands

**Copy-paste ready commands:**

```bash
# 1. Check metrics
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/monitoring/metrics | jq

# 2. Reset metrics
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/monitoring/metrics | jq

# 3. Get recommendations
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/internships/recommended | jq

# 4. Run background refresh
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/refresh-recommendations | jq

# 5. Vectorize internships
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids":["ID1","ID2"]}' \
  http://localhost:3000/api/admin/vectorize | jq
```

---

## Summary

Phase 6 introduces:
- **Metrics Monitoring**: Track system performance in real-time
- **HNSW Integration**: Fast approximate search for recommendations
- **Smart Caching**: Reduce unnecessary computations with 24h TTL
- **Background Refresh**: Proactively update caches for active users
- **Event-Driven**: Scalable architecture with minimal global operations

All components work together to provide a scalable, efficient recommendation system.
