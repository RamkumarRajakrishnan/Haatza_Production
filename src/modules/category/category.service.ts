import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CategoryService {
  constructor(private readonly db: DatabaseService) {}

  async getCategories() {
    return this.db.category.findMany({ where: { parentId: null } });
  }

  async getSubcategories(parentId: string) {
    return this.db.category.findMany({ where: { parentId } });
  }

  async searchCategories(query: string) {
    return this.db.category.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
    });
  }

  async getCategoryFields(categoryId: string) {
    const cat = await this.db.category.findUnique({ where: { id: categoryId } });
    return cat?.fields || [];
  }
}
