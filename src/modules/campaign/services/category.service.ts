import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable } from '@nestjs/common';
import { vwCategories } from '@schemas/categories';

@Injectable()
export class CategoryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async findAll() {
    return await this.db.query.categories.findMany();
  }

  async lookupCategories() {
    return await this.db.select().from(vwCategories);
  }
}
