import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTagDto {
  @IsNotEmpty({ message: '标签名称不能为空' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;
}
