import { Controller, Get } from '@nestjs/common';
import { CategoryService } from './services/category.service';
import { Public } from '@modules/auth/decorators';
import { z } from 'zod';
import { LookupCampaignSchema } from './dto/category.dto';

@Controller('/categories')
@Public()
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  @Get()
  async findAllCategories() {
    return await this.categoryService.findAll();
  }

  @Get('lookup')
  async lookupCategories() {
    const result = await this.categoryService.lookupCategories();
    return z.array(LookupCampaignSchema).parse(result);
  }
}
