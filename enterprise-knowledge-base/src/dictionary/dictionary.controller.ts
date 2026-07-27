import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DictionaryService } from './dictionary.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Controller()
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  // ==========================================
  // 分类字典接口 (/categories)
  // ==========================================

  /** 新建分类 */
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.dictionaryService.createCategory(dto);
  }

  /** 获取所有分类列表 */
  @Get('categories')
  findAllCategories() {
    return this.dictionaryService.findAllCategories();
  }

  /** 获取单条分类详情 */
  @Get('categories/:id')
  findCategoryById(@Param('id') id: string) {
    return this.dictionaryService.findCategoryById(id);
  }

  /** 更新分类 */
  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.dictionaryService.updateCategory(id, dto);
  }

  /** 删除分类 */
  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.dictionaryService.removeCategory(id);
  }

  // ==========================================
  // 团队字典接口 (/teams)
  // ==========================================

  /** 新建团队 */
  @Post('teams')
  createTeam(@Body() dto: CreateTeamDto) {
    return this.dictionaryService.createTeam(dto);
  }

  /** 获取所有团队列表 */
  @Get('teams')
  findAllTeams() {
    return this.dictionaryService.findAllTeams();
  }

  /** 获取单条团队详情 */
  @Get('teams/:id')
  findTeamById(@Param('id') id: string) {
    return this.dictionaryService.findTeamById(id);
  }

  /** 更新团队 */
  @Patch('teams/:id')
  updateTeam(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.dictionaryService.updateTeam(id, dto);
  }

  /** 删除团队 */
  @Delete('teams/:id')
  removeTeam(@Param('id') id: string) {
    return this.dictionaryService.removeTeam(id);
  }

  // ==========================================
  // 标签字典接口 (/tags)
  // ==========================================

  /** 新建标签 */
  @Post('tags')
  createTag(@Body() dto: CreateTagDto) {
    return this.dictionaryService.createTag(dto);
  }

  /** 获取所有标签列表 */
  @Get('tags')
  findAllTags() {
    return this.dictionaryService.findAllTags();
  }

  /** 获取热门标签（按使用频率倒序） */
  @Get('tags/hot')
  findHotTags(@Query('limit') limit?: number) {
    return this.dictionaryService.findHotTags(limit ? Number(limit) : 20);
  }

  /** 获取单条标签详情 */
  @Get('tags/:id')
  findTagById(@Param('id') id: string) {
    return this.dictionaryService.findTagById(id);
  }

  /** 更新标签（名称、颜色等） */
  @Patch('tags/:id')
  updateTag(
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.dictionaryService.updateTag(id, dto);
  }

  /** 删除标签 */
  @Delete('tags/:id')
  removeTag(@Param('id') id: string) {
    return this.dictionaryService.removeTag(id);
  }
}
