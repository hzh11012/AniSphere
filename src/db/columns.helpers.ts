import { integer } from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
};

const versioning = {
  version: integer('version').notNull().default(0)
};

export { timestamps, versioning };
