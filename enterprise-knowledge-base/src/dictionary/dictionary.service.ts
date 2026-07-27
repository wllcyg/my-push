import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';
import { TeamEntity } from './entities/team.entity';
import { TagEntity } from './entities/tag.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { nextSnowflakeId } from '../common/snowflake-id';

@Injectable()
export class DictionaryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,
    @InjectRepository(TagEntity)
    private readonly tagRepo: Repository<TagEntity>,
  ) {}

  // ==========================================
  // 分类字典 CRUD (Categories)
  // ==========================================

  async createCategory(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const existing = await this.categoryRepo.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`分类编码 [${dto.code}] 已存在`);
    }

    const category = this.categoryRepo.create({
      id: nextSnowflakeId(),
      name: dto.name,
      code: dto.code,
      remark: dto.remark,
    });

    return this.categoryRepo.save(category);
  }

  async findAllCategories(): Promise<CategoryEntity[]> {
    return this.categoryRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  async findCategoryById(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`分类 [ID: ${id}] 不存在`);
    }
    return category;
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryEntity> {
    const category = await this.findCategoryById(id);

    if (dto.code && dto.code !== category.code) {
      const existing = await this.categoryRepo.findOne({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException(`分类编码 [${dto.code}] 已存在`);
      }
      category.code = dto.code;
    }

    if (dto.name) category.name = dto.name;
    if (dto.remark !== undefined) category.remark = dto.remark;

    return this.categoryRepo.save(category);
  }

  async removeCategory(id: string): Promise<{ id: string; success: boolean }> {
    const category = await this.findCategoryById(id);
    await this.categoryRepo.remove(category);
    return { id, success: true };
  }

  // ==========================================
  // 团队字典 CRUD (Teams)
  // ==========================================

  async createTeam(dto: CreateTeamDto): Promise<TeamEntity> {
    const existing = await this.teamRepo.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`团队编码 [${dto.code}] 已存在`);
    }

    const team = this.teamRepo.create({
      id: nextSnowflakeId(),
      name: dto.name,
      code: dto.code,
      remark: dto.remark,
    });

    return this.teamRepo.save(team);
  }

  async findAllTeams(): Promise<TeamEntity[]> {
    return this.teamRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  async findTeamById(id: string): Promise<TeamEntity> {
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException(`团队 [ID: ${id}] 不存在`);
    }
    return team;
  }

  async updateTeam(id: string, dto: UpdateTeamDto): Promise<TeamEntity> {
    const team = await this.findTeamById(id);

    if (dto.code && dto.code !== team.code) {
      const existing = await this.teamRepo.findOne({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException(`团队编码 [${dto.code}] 已存在`);
      }
      team.code = dto.code;
    }

    if (dto.name) team.name = dto.name;
    if (dto.remark !== undefined) team.remark = dto.remark;

    return this.teamRepo.save(team);
  }

  async removeTeam(id: string): Promise<{ id: string; success: boolean }> {
    const team = await this.findTeamById(id);
    await this.teamRepo.remove(team);
    return { id, success: true };
  }

  // ==========================================
  // 标签字典 CRUD (Tags)
  // ==========================================

  async createTag(dto: CreateTagDto): Promise<TagEntity> {
    const existing = await this.tagRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`标签 [${dto.name}] 已存在`);
    }

    const tag = this.tagRepo.create({
      id: nextSnowflakeId(),
      name: dto.name,
      color: dto.color ?? '#108ee9',
      quoteCount: 0,
    });

    return this.tagRepo.save(tag);
  }

  async findAllTags(): Promise<TagEntity[]> {
    return this.tagRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  /** 获取热门标签（按引用使用次数倒序） */
  async findHotTags(limit = 20): Promise<TagEntity[]> {
    return this.tagRepo.find({
      order: { quoteCount: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  async findTagById(id: string): Promise<TagEntity> {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`标签 [ID: ${id}] 不存在`);
    }
    return tag;
  }

  async updateTag(id: string, dto: UpdateTagDto): Promise<TagEntity> {
    const tag = await this.findTagById(id);

    if (dto.name && dto.name !== tag.name) {
      const existing = await this.tagRepo.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`标签名称 [${dto.name}] 已存在`);
      }
      tag.name = dto.name;
    }

    if (dto.color !== undefined) tag.color = dto.color;

    return this.tagRepo.save(tag);
  }

  async removeTag(id: string): Promise<{ id: string; success: boolean }> {
    const tag = await this.findTagById(id);
    await this.tagRepo.remove(tag);
    return { id, success: true };
  }
}
