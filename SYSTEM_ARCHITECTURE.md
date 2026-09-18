# iFind Application Architecture & System Workflow

> **Location**: [`ifind/`](file:///c:/Users/4dmin/Downloads/iFind30/ifind)  
> **Global Architecture Guide**: See root document [`SYSTEM_ARCHITECTURE.md`](file:///c:/Users/4dmin/Downloads/iFind30/SYSTEM_ARCHITECTURE.md)

---

## Quick Reference & Entry Point Overview

`ifind` is the core full-stack web application of the **iFind Platform**. It manages authentication, user profile management, resume upload and AI parsing, job listing moderation, and hybrid candidate-to-internship recommendation matching.

---

## 1. Directory Structure

```
ifind/
├── app/                        # Next.js 16 App Router Pages & API Routes
│   ├── api/                    # Serverless API endpoints
│   │   ├── admin/              # Admin moderation & batch vectorization
│   │   ├── auth/               # Authentication endpoints
│   │   ├── cron/               # Scheduled pipeline triggers
│   │   ├── internships/        # Internship browsing, search, recommendations
│   │   └── user/               # User profiles, photo, password, resume upload/vectorization
│   ├── dashboard/              # Candidate dashboard (Overview, Internships, Resume, Saved)
│   ├── internships/            # Internship details & catalog pages
│   ├── login/ & register/      # User authentication screens
│   ├── overview/ & profile/    # Account & profile management
│   └── page.tsx                # Landing homepage
├── components/                 # React UI Components
│   ├── dashboard/              # Dashboard tab views (ResumeTab, OverviewTab, etc.)
│   ├── internships/            # Internship cards, filters, search bars
│   ├── landing/                # Homepage hero, features, testimonials
│   ├── layout/                 # Main Navbar, Footer, Sidebar
│   └── ui/                     # Radix UI primitives & styled components
├── lib/                        # Core Application Libraries & Services
│   ├── api.ts                  # Client-side API fetch wrappers
│   ├── auth.ts                 # NextAuth & JWT authentication config
│   ├── db.ts                   # Mongoose MongoDB connection caching
│   ├── gridfs.ts               # MongoDB GridFS PDF resume bucket storage
│   ├── openai.ts               # OpenAI client configuration
│   ├── resumeParser.ts         # Double-tier AI Parser (OpenAI gpt-4o -> Gemini 2.5 Flash fallback)
│   └── pipeline/               # Job Ingestion & Auto-Moderation Pipeline
│       ├── normalizer.ts       # Normalizes raw scraped data
│       ├── validator.ts        # Schema validation
│       ├── deduplicator.ts     # SHA-256 fingerprinting & duplicate detection
│       ├── linkVerifier.ts     # HTTP link safety, expired check & scam detection
│       └── scorer.ts           # Job posting quality scoring (0-100)
├── models/                     # Mongoose Schemas
│   ├── User.ts                 # Candidate user model, resume data, scores & saved jobs
│   └── Internship.ts           # Moderated internship document model with link health & moderation status
├── scripts/                    # CLI Operations & Automation
│   ├── scrape-and-moderate.mjs # Main scraper execution runner
│   ├── run-recommender.mjs     # Hybrid TF-IDF + BERT recommendation computation
│   └── vectorise-all.mjs       # Batch vector generation for internships
└── cron-job/                   # Python Flask & APScheduler background daemon
    └── app.py                  # Recurring job scheduler for scrapers and link health
```

---

## 2. Technical Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + Radix UI + Lucide Icons + Sonner Toasts
- **Database**: MongoDB via Mongoose 9 + GridFS Bucket for PDF storage
- **AI Services**: OpenAI API (`gpt-4o`) & Google Gemini API (`gemini-2.5-flash`)
- **Machine Learning**: TF-IDF & BERT Embeddings (`sentence-transformers/all-mpnet-base-v2`) via Hugging Face Space (`https://seudoe-vectorisationResume.hf.space`)

---

## 3. Core Workflows

### A. Resume Upload & Processing
1. Candidate uploads PDF resume (<5MB).
2. Saved to MongoDB GridFS via [`lib/gridfs.ts`](file:///c:/Users/4dmin/Downloads/iFind30/ifind/lib/gridfs.ts).
3. Parsed into structured JSON via [`lib/resumeParser.ts`](file:///c:/Users/4dmin/Downloads/iFind30/ifind/lib/resumeParser.ts) using OpenAI `gpt-4o` (or Gemini fallback).
4. Extracted data shown in UI staging view for candidate verification.
5. Upon confirmation, candidate data is committed to candidate profile in [`models/User.ts`](file:///c:/Users/4dmin/Downloads/iFind30/ifind/models/User.ts) and vectorized via `/api/user/resume/vectorize`.

### B. Ingestion & Auto-Moderation Pipeline
1. Raw internship listings gathered via scrapers or external submit.
2. Filtered, normalized, validated, fingerprinted, link-verified, and quality-scored via [`lib/pipeline/`](file:///c:/Users/4dmin/Downloads/iFind30/ifind/lib/pipeline).
3. Score $\ge 70 \rightarrow$ Auto-approved; Score $40-69 \rightarrow$ Pending admin review; Score $<40$ or scam flag $\rightarrow$ Auto-rejected.

### C. Recommendation Engine
- Hybrid cosine score calculation:
  $$\text{Score} = 0.4 \times \text{Similarity}_{\text{TF-IDF}} + 0.6 \times \text{Similarity}_{\text{BERT}}$$
- Top 20 relevant internships saved directly to candidate profile (`user.recommendedInternships`).

---

## 4. How to Run

```bash
# Navigate to project directory
cd ifind

# Install dependencies
npm install

# Start Next.js Development Server
npm run dev

# Run Scraper Pipeline
npm run scrape

# Run Batch Recommendation Engine
node scripts/run-recommender.mjs
```
