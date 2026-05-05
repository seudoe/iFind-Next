# Step 1 — encode everything (run once after DB reset)
node scripts/vectorise-all.mjs

# Step 1a — encode only internships
node scripts/vectorise-all.mjs --only=internships

# Step 1b — encode only user resumes
node scripts/vectorise-all.mjs --only=resumes

# Step 2 — run recommender, save top 20 per user
node scripts/run-recommender.mjs

# Step 2 with custom settings
node scripts/run-recommender.mjs --top=30 --threshold=0.15

# Step 2 for a single user (useful during dev)
node scripts/run-recommender.mjs --user=664a1b2c3d4e5f6a7b8c9d02
