import { Public } from '@modules/auth/decorators';
import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { LookupCampaignSchema } from './dto/category.dto';
import { CategoryService } from './services/category.service';

@Controller('categories')
@Public()
export class CategoryController {
  private logger = new Logger(CategoryController.name);
  constructor(private categoryService: CategoryService) {
    this.logger.verbose('listening to /categories command');
  }

  @Get()
  @ApiTags('Public Api')
  async findAllCategories() {
    return await this.categoryService.findAll();
  }

  @Get('lookup')
  @ApiTags('Public Api')
  async lookupCategories() {
    const result = await this.categoryService.lookupCategories();
    return z.array(LookupCampaignSchema).parse(result);
  }
}
