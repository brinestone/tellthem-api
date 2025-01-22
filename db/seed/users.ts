import { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { users } from '../schema/users';
import { schema } from '@schemas/all';

export const name = 'users';
export async function seed(
  t: PgTransaction<NodePgQueryResultHKT, typeof schema>,
) {
  const systemUserId = 1;
  await t
    .insert(users)
    .overridingSystemValue()
    .values({
      id: systemUserId,
      names: 'System',
      email: 'support@tellthem.netlify.app',
    })
    .onConflictDoNothing({
      target: [users.id],
    });
}
