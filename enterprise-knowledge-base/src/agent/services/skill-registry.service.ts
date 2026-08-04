import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface SkillMetadata {
  name: string;
  description: string;
  keywords: string[];
  filePath: string;
  body: string;
}

@Injectable()
export class SkillRegistryService implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistryService.name);
  private skillsMap = new Map<string, SkillMetadata>();

  onModuleInit() {
    this.reloadSkills();
  }

  /**
   * 自动扫描 skills 目录并解析所有 .md 顶部的 YAML Frontmatter 元数据
   */
  public reloadSkills(): void {
    try {
      // 容错探测候选路径 (解决 ts-node 与 dist 编译打包后 .md 文件位置不一致的问题)
      const possibleDirs = [
        path.join(process.cwd(), 'src/agent/skills'),
        path.join(process.cwd(), 'enterprise-knowledge-base/src/agent/skills'),
        path.join(__dirname, '../skills'),
        path.join(__dirname, '../../skills'),
      ];

      let skillsDir = '';
      for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
          skillsDir = dir;
          break;
        }
      }

      if (!skillsDir) {
        this.logger.warn('⚠️ [SkillRegistry] 未找到任何有效的 skills 技能目录');
        return;
      }

      const files = fs.readdirSync(skillsDir).filter((file) => file.endsWith('.md'));
      this.skillsMap.clear();


      for (const file of files) {
        const filePath = path.join(skillsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // 解析 YAML Frontmatter (匹配 --- ... ---)
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
        const match = frontmatterRegex.exec(fileContent);

        if (match) {
          const yamlText = match[1];
          const body = match[2];

          const name = this.extractYamlField(yamlText, 'name') || file.replace('.md', '');
          const description = this.extractYamlField(yamlText, 'description') || '';
          const keywordsStr = this.extractYamlField(yamlText, 'keywords') || '[]';
          let keywords: string[] = [];
          try {
            keywords = JSON.parse(keywordsStr);
          } catch {
            keywords = [];
          }

          this.skillsMap.set(name, {
            name,
            description,
            keywords,
            filePath,
            body: body.trim(),
          });

          this.logger.log(`📌 [SkillRegistry] 成功注册 Skill: ${name} (关键字: ${keywords.join(', ')})`);
        } else {
          // 未找到 YAML Frontmatter 的备用容灾解析
          this.skillsMap.set(file, {
            name: file.replace('.md', ''),
            description: '',
            keywords: [],
            filePath,
            body: fileContent.trim(),
          });
        }
      }

      this.logger.log(`✅ [SkillRegistry] 共解析并预加载了 ${this.skillsMap.size} 个 YAML 元数据技能`);
    } catch (error) {
      this.logger.error(`❌ [SkillRegistry] 扫描 Skill 目录失败: ${(error as Error).message}`);
    }
  }

  /**
   * 生成给大模型的轻量技能清单 (Skill Manifest Roster)
   * 预先告知大模型系统具备哪些 Skill 的元数据描述
   */
  public getSkillManifestPrompt(): string {
    if (this.skillsMap.size === 0) return '';

    const manifestItems: string[] = [];
    this.skillsMap.forEach((meta) => {
      manifestItems.push(`- 【技能: ${meta.name}】: ${meta.description}`);
    });

    return `\n【系统预设技能清单】:\n${manifestItems.join('\n')}\n`;
  }

  /**
   * 根据用户提问关键词/语义，按需精确定位并仅装载匹配到的 Skill 详细 Markdown 正文
   * （零 Token 浪费，仅在触发时动态激活对应的 Skill 细则）
   */
  public getMatchedSkillBodies(userQuery: string): string {
    if (!userQuery || this.skillsMap.size === 0) return '';

    const matchedBodies: string[] = [];
    const queryLower = userQuery.toLowerCase();

    this.skillsMap.forEach((meta) => {
      // 1. 关键词精确与模糊命中
      const isKeywordHit = meta.keywords.some((kw) => queryLower.includes(kw.toLowerCase()));
      // 2. 名称命中
      const isNameHit = queryLower.includes(meta.name.toLowerCase());
      // 3. 通用绘图触发词兜底 (如包含 "画", "图", "展示", "占比", "对比")
      const isDrawIntentHit =
        meta.name === 'echarts-visualization' &&
        /[画图表对比趋势占比折线饼图柱状漏斗雷达]/.test(queryLower);

      if (isKeywordHit || isNameHit || isDrawIntentHit) {
        this.logger.log(`🎯 [SkillRegistry] 动态激活技能: ${meta.name} (针对用户提问: "${userQuery}")`);
        matchedBodies.push(`<!-- 动态激活技能规范: ${meta.name} -->\n${meta.body}`);
      }
    });

    return matchedBodies.join('\n\n---\n\n');
  }


  private extractYamlField(yamlText: string, fieldName: string): string | null {
    const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');
    const match = regex.exec(yamlText);
    if (!match) return null;
    let val = match[1].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    return val;
  }
}
