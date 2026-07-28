import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export abstract class BaseRepository<T> {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly modelName: keyof PrismaClient,
  ) {}

  protected get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }

  async findMany(params?: { where?: any; orderBy?: any; take?: number; skip?: number; include?: any }): Promise<T[]> {
    return this.model.findMany(params);
  }

  async create(data: any): Promise<T> {
    return this.model.create({ data });
  }

  async update(id: string, data: any): Promise<T> {
    return this.model.update({ where: { id }, data });
  }

  async delete(id: string): Promise<T> {
    return this.model.delete({ where: { id } });
  }

  async count(where?: any): Promise<number> {
    return this.model.count({ where });
  }
}
