import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable } from '@nestjs/common';
import { userPrefs } from '@schemas/users';
import { eq } from 'drizzle-orm';
import { UpdatePrefsDto } from '../dto';

@Injectable()
export class UserService {
  async findUserConnections(id: number) {
    return await this.db.query.accountConnections.findMany({
      columns: {
        id: true,
        createdAt: true,
        updatedAt: true,
        provider: true,
        status: true,
      },
      where: (connections, { eq }) => eq(connections.user, id),
    });
  }
  async updateUserPrefs(user: number, update: UpdatePrefsDto) {
    return await this.db.transaction((t) =>
      t.update(userPrefs).set(update).where(eq(userPrefs.user, user)),
    );
  }
  async findUserPrefs(user: number) {
    return await this.db.query.userPrefs.findFirst({
      where: (prefs, { eq }) => eq(prefs.user, user),
    });
  }
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}
}
