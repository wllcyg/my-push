import { z } from 'zod'

// 电竞选手的结构化 Schema，供全局使用
export const athleteSchema = z.object({
    name: z.string().describe("电竞选手的全名"),
    id: z.string().describe("选手的游戏ID/网名"),
    birth_year: z.number().describe("出生年份"),
    retirement_year: z.number().optional().describe("退役年份，如果仍在役则不填"),
    nationality: z.string().describe("国籍"),
    games: z.array(z.string()).describe("参与的电竞游戏项目列表"),
    in_game_role: z.string().describe("游戏中的位置或分工，例如中单、打野、ADC等"),
    current_team: z.string().optional().describe("当前所在战队，退役则不填"),
    awards: z.array(
        z.object({
            name: z.string().describe("奖项名称"),
            year: z.number().describe("获奖年份"),
            tournament: z.string().optional().describe("所在赛事或联赛")
        })
    ).describe("获得的重要奖项列表"),
    major_achievements: z.array(z.string()).describe("主要成就列表"),
    tournament_results: z.array(
        z.object({
            tournament: z.string().describe("赛事名称"),
            year: z.number().optional().describe("参赛年份"),
            result: z.string().describe("比赛成绩，例如冠军、亚军等")
        })
    ).describe("重要赛事战绩列表"),
    education: z.object({
        university: z.string().describe("主要毕业院校"),
        degree: z.string().describe("学位"),
        graduation_year: z.number().optional().describe("毕业年份")
    }).optional().describe("教育背景"),
    biography: z.string().describe("简短传记，100字以内")
})

// 导出类型，方便 TypeScript 使用
export type Athlete = z.infer<typeof athleteSchema>
