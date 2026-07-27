import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsNotEmpty({ message: '团队名称不能为空' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: '团队编码不能为空' })
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
