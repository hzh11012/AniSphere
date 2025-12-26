import {
  index,
  integer,
  text,
  boolean,
  pgTable,
  varchar
} from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';

const usersTable = pgTable(
  'users',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    status: boolean().notNull().default(true),
    avatar: text(),
    ...timestamps
  },
  table => [
    index('users_name_idx').on(table.name),
    index('users_email_idx').on(table.email),
    index('users_status_idx').on(table.status)
  ]
);

export { usersTable };
