import { spawn } from 'node:child_process'

const command = 'echo -e "n\\nn" | pnpm create vite react-todo-app --template react-ts';
const cwd = process.cwd()

// 解析命令和参数

const [cmd, ...args] = command.split(' ')

console.log(cmd, args)

const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
})

let errorMsg = ''

child.on('error', (err) => {
    errorMsg = err.message
})

child.on('close', (code) => {
    if (code !== 0) {
        console.error(`子进程退出，退出码 ${code}`);
    }
    if (errorMsg) {
        console.error(`执行失败: ${errorMsg}`);
    }
});

child.on('exit', (code) => {
    if (code !== 0) {
        console.error(`子进程退出，退出码 ${code}`);
    }
    if (errorMsg) {
        console.error(`执行失败: ${errorMsg}`);
    }
})