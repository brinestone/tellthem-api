import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable } from '@nestjs/common';
import { UpdatePrefsInput, userPrefs } from '@schemas/users';
import { eq } from 'drizzle-orm';

@Injectable()
export class UserService {
  async updateUserPrefs(user: number, update: UpdatePrefsInput) {
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
