import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsNotEmpty({ message: '分类名称不能为空' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: '分类编码不能为空' })
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
