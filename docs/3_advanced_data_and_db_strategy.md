# Advanced Data & Database Strategy

## 1. Synthetic Data Generation: LLMs vs. Builders

LLMs can be used for data generation, **but with caveats.**

### Option A: LLM-Based Generation (The "Smart" Way)
**Use Case**: When you need complex, context-aware text (e.g., "a polite complaint email about a broken toaster" or "a valid SQL injection attack string"). Faker is bad at semantic meaning; LLMs are great at it.

**Implementation**:
You can create a helper that calls an LLM API (OpenAI/Gemini) to generate JSON data.

```typescript
// src/utils/llm-data-gen.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateTestUser(scenario: string) {
  const completion = await openai.chat.completions.create({
    messages: [{ 
      role: "system", 
      content: "You are a test data generator. Return ONLY valid JSON." 
    }, {
      role: "user", 
      content: `Generate a user profile for: ${scenario}. Schema: { name, bio, preferences[] }`
    }],
    model: "gpt-3.5-turbo",
  });

  return JSON.parse(completion.choices[0].message.content);
}
```

**Pros**:
- High quality, realistic, context-heavy data.
- Can generate edge cases you might not think of.

**Cons**:
- **Slow**: API calls take 1-3 seconds. Faker takes milliseconds.
- **Cost**: Not free.
- **Non-Deterministic**: You might get different results each time, making debugging harder.

**Recommendation**: Use **Faker** for 95% of structural data (names, emails, IDs). Use **LLMs** only for specific content-heavy fields (bios, reviews, emails).

---

## 2. Database Connection Pooling (Worker Scope)

You correctly identified that connecting/disconnecting per test is inefficient.

**The Solution: Worker-Scoped Fixtures**
Playwright runs tests in parallel "workers" (OS processes). If you have 4 workers, you want 4 DB connections (one per worker), reused by all tests in that worker.

### How it works
1.  **Worker Start**: Connect to DB.
2.  **Tests Run**: All tests in this worker reuse the *same* connection instance.
3.  **Worker End**: Disconnect.

### Implementation

```typescript
// src/fixtures/db.fixture.ts
import { test as base } from '@playwright/test';
import { Pool } from 'pg'; // 'pg' library has built-in pooling

// 1. Define the Worker Fixture Type
type WorkerFixtures = {
  dbPool: Pool;
};

// 2. Define the Test Fixture Type (if you need per-test context)
type TestFixtures = {
  db: Pool; // In this case, we just pass the pool down
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  
  // WORKER SCOPED FIXTURE (Runs once per worker process)
  dbPool: [async ({}, use) => {
    // Setup: Create the pool
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // 1 connection per worker is usually enough
      idleTimeoutMillis: 30000
    });
    
    console.log('Worker connected to DB');
    
    // Use: Pass the pool to tests
    await use(pool);
    
    // Teardown: Close pool when worker shuts down
    await pool.end();
    console.log('Worker disconnected from DB');
  }, { scope: 'worker' }], // <--- CRITICAL: Set scope to 'worker'

  // TEST SCOPED FIXTURE (Runs per test)
  db: async ({ dbPool }, use) => {
    // Just pass the already-connected pool to the test
    await use(dbPool);
  },
});
```

### Addressing Your Concerns
*   **"Any way I can pool connections?"**: Yes, using `scope: 'worker'` creates one pool per worker process.
*   **"Will this be a problem when I run tests in parallel?"**: No. Since Playwright workers are separate processes, they don't share memory. Each worker gets its own isolated DB pool. If you run 4 workers, you will have 4 active DB connections total. This is very efficient.
*   **"Will it slow down the tests?"**: No, it will **speed them up**. You pay the connection cost only once per worker (at startup), instead of once per test.

### Best Practice: Database Cleaning
Since you are reusing connections, you must ensure tests don't pollute the DB for each other.
- **Transaction Rollback**: Start a transaction in `beforeEach` and rollback in `afterEach`.
- **Unique Data**: Use the Builder pattern to ensure every test uses unique IDs/Emails, so they never collide even if data persists.
