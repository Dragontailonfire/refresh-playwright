# Deep Dive: Scalable Data Management in Playwright

This guide covers the three pillars of scalable test data: **Generation** (Builders/Faker), **State Management** (API Seeding), and **Verification** (Database Fixtures).

## 1. The Data Builder Pattern with Faker
**Problem**: Hardcoded data (`const user = { name: 'John' }`) leads to conflicts when tests run in parallel.
**Solution**: Generate unique, valid data for every test run using a **Builder Pattern**.

### Concept
A "Builder" is a class responsible for constructing a complex object step-by-step. It provides sensible defaults but allows overrides.

### Implementation
First, install faker: `npm install @faker-js/faker`

```typescript
// src/factories/user-builder.ts
import { faker } from '@faker-js/faker';

export type UserData = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

export class UserBuilder {
  private data: UserData;

  constructor() {
    // 1. Set sensible defaults using Faker
    this.data = {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      isActive: true,
    };
  }

  // 2. Fluent methods to override defaults
  withEmail(email: string) {
    this.data.email = email;
    return this; // Return 'this' for chaining
  }

  inactive() {
    this.data.isActive = false;
    return this;
  }

  // 3. The build method returns the final object
  build(): UserData {
    return this.data;
  }
}
```

### Usage in Test
```typescript
import { test } from '@playwright/test';
import { UserBuilder } from '../factories/user-builder';

test('should register a new user', async ({ page }) => {
  // Generate unique data for this specific test
  const newUser = new UserBuilder()
    .withEmail('admin@example.com') // Override specific field
    .build();

  await page.getByLabel('Email').fill(newUser.email);
  await page.getByLabel('First Name').fill(newUser.firstName);
  // ...
});
```

---

## 2. API Seeding (Bypassing the UI)
**Problem**: Logging in or creating items via UI is slow (seconds). Doing this for 100 tests adds minutes to your build.
**Solution**: Use API calls to set up the "Arrange" phase of your test.

### Concept
Use Playwright's `request` context to make HTTP calls directly to your backend to create the state you need *before* the UI test starts.

### Implementation
```typescript
// src/utils/api-utils.ts
import { APIRequestContext } from '@playwright/test';
import { UserData } from '../factories/user-builder';

export class ApiUtils {
  constructor(private request: APIRequestContext) {}

  async createUser(user: UserData) {
    const response = await this.request.post('/api/v1/users', {
      data: user
    });
    if (!response.ok()) throw new Error('Failed to seed user');
    return await response.json();
  }
}
```

### Usage in Test
```typescript
test('should edit an existing user', async ({ page, request }) => {
  // 1. ARRANGE: Create user via API (Fast, <100ms)
  const user = new UserBuilder().build();
  const api = new ApiUtils(request);
  await api.createUser(user);

  // 2. ACT: Interact via UI
  await page.goto(`/users/${user.id}/edit`);
  await page.getByLabel('Last Name').fill('Updated');
  await page.getByRole('button', { name: 'Save' }).click();

  // 3. ASSERT
  await expect(page.getByText('User updated')).toBeVisible();
});
```

---

## 3. Database Fixtures (The "Playwright Way")
**Problem**: Sometimes API isn't enough. You need to verify a DB record was created, or clean up data that the API doesn't expose.
**Solution**: Inject a Database Client into your tests using a **Fixture**, just like `page` or `request`.

### Concept
We extend the standard `test` object. In the fixture setup, we connect to the DB. In the teardown (after `use`), we close the connection. This ensures connection pooling is handled automatically.

### Implementation

**Step 1: Create the DB Client Wrapper**
```typescript
// src/lib/db-client.ts
import { Client } from 'pg'; // Example using PostgreSQL

export class DbClient {
  private client: Client;

  constructor() {
    this.client = new Client({ connectionString: process.env.DATABASE_URL });
  }

  async connect() {
    await this.client.connect();
  }

  async close() {
    await this.client.end();
  }

  async getUser(email: string) {
    const res = await this.client.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0];
  }
}
```

**Step 2: Create the Fixture**
```typescript
// src/fixtures/db.fixture.ts
import { test as base } from '@playwright/test';
import { DbClient } from '../lib/db-client';

// Define the type of our new fixture
type DbFixtures = {
  db: DbClient;
};

// Extend the base test
export const test = base.extend<DbFixtures>({
  db: async ({}, use) => {
    // 1. Setup: Connect to DB
    const dbClient = new DbClient();
    await dbClient.connect();

    // 2. Use: Pass the client to the test
    await use(dbClient);

    // 3. Teardown: Close connection after test finishes
    await dbClient.close();
  },
});
```

### Usage in Test
Now, any test can request `db` just like it requests `page`.

```typescript
import { test } from '../fixtures/db.fixture'; // Import YOUR extended test
import { expect } from '@playwright/test';

test('should save user to database', async ({ page, db }) => {
  // ... perform UI actions that register a user ...
  await page.getByRole('button', { name: 'Register' }).click();

  // Direct Database Verification
  const dbUser = await db.getUser('test@example.com');
  expect(dbUser).toBeDefined();
  expect(dbUser.is_active).toBe(true);
});
```

### Why this is "Scalable"
1.  **Automatic Cleanup**: The `db` connection is always closed, even if the test fails.
2.  **Isolation**: You can start a transaction in the setup and rollback in the teardown, ensuring tests never affect each other's data.
3.  **Simplicity**: Test writers don't need to know *how* to connect to the DB, they just use the `db` object.
