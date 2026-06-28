import { tool } from "@langchain/core/tools";
import { spawn } from "child_process";
import { readFileTool } from '@/tools/readFile.js'
import fs from "fs";
import { z } from "zod";


// 写入文件的 tool
const writeFileTool = tool(
    async ({ filePath, content }: { filePath: string, content: string }) => {
        try {
            await fs.promises.writeFile(filePath, content, 'utf-8');
            return `Successfully wrote to ${filePath}`;
        } catch (error) {
            return `Error writing to file: ${error instanceof Error ? error.message : String(error)}`;
        }
    },
    {
        name: 'write_file',
        description: `
            用这个工具来修改文件,可以覆盖文件内容
            当用户要求你修改文件内容的时候,就用这个工具
        `,
        schema: z.object({
            filePath: z.string().describe('要修改的文件的路径'),
            content: z.string().describe('要写入的内容'),
        }),
    }
);

// 列出目录内容的 tool
const listDirTool = tool(
    async ({ dirPath }: { dirPath: string }) => {
        try {
            const files = await fs.promises.readdir(dirPath);
            return `Files in ${dirPath}:\n${files.join('\n')}`;
        } catch (error) {
            return `Error listing directory: ${error instanceof Error ? error.message : String(error)}`;
        }
    },
    {
        name: 'list_dir',
        description: `
            用这个工具来列出目录内容,查看文件和目录
            当用户要求你列出目录内容的时候,就用这个工具
        `,
        schema: z.object({
            dirPath: z.string().describe('要列出的目录的路径'),
        }),
    }
);

// 执行命令的 tool
const execCommandTool = tool(
    async ({ command, workingDirectory }: { command: string, workingDirectory?: string }) => {
        const cwd = workingDirectory ?? process.cwd();
        return new Promise((resolve, reject) => {
            const [cmd, ...args] = command.split(' ');

            const child = spawn(cmd, args, {
                cwd,
                stdio: 'inherit',
                shell: true
            })

            let errorMsg = ''

            child.on('error', (err) => {
                errorMsg = err.message
            })

            child.on('close', (code) => {
                if (code === 0) {
                    console.log(`工具调用 ${command} - 执行成功`);
                    const cwdInfo = workingDirectory ?
                        `\n\n重要提示:命令在目录${workingDirectory}中执行成功,如果在在这个项目目录中继续执行命令请使用 workingDirectory:""${workingDirectory}参数,不要使用 cd 命令`
                        : ''
                    resolve(`命令执行成功:${command}${cwdInfo}`)
                } else {

                    resolve(`命令执行失败,退出码:${code}${errorMsg}'\n 错误:'+ errorMsg:'`)
                }
            })

        })
    },
    {
        name: 'exec_command',
        description: '执行系统的命令,指定工作目录,实时显示输出',
        schema: z.object({
            command: z.string().describe('要执行的命令'),
            workingDirectory: z.string().optional().describe('工作目录(推荐指定)'),
        }),
    }


)


export { readFileTool, writeFileTool, listDirTool, execCommandTool }