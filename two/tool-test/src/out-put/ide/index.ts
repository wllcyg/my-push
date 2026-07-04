import { db } from "@/db.js";

// 初始化数据库和表结构
export async function initDB() {
    const connection = await db;
    await connection.query('CREATE DATABASE IF NOT EXISTS hello CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    await connection.query('USE hello;');

    await connection.query(`
        CREATE TABLE IF NOT EXISTS friends (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            gender VARCHAR(10),                -- 性别
            birth_date DATE,                   -- 出生日期
            company VARCHAR(100),              -- 公司
            title VARCHAR(100),                -- 职位
            phone VARCHAR(20),                 -- 当前手机号
            wechat VARCHAR(50)                 -- 微信号
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
}

// 提取出来的公共插入方法
export async function insertFriends(dataArray: any[][]) {
    const connection = await db;
    await connection.query('USE hello;');

    const insertSql = `
        INSERT INTO friends (
            name,
            gender,
            birth_date,
            company,
            title,
            phone,
            wechat
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    const insertIds: number[] = [];

    for (const values of dataArray) {
        const [result]: any = await connection.query(insertSql, values);
        console.log(`✅ 成功插入：${values[0]}，插入ID：${result.insertId}`);
        insertIds.push(result.insertId);
    }

    return insertIds;
}

// 仅当直接运行该文件时才执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    async function runTest() {
        try {
            await initDB();

            const testData = [
                ["王经理", "男", "1990-01-01", "字节跳动", "产品总监", "18612345678", "wangjingli2024"],
                ["李小红", "女", "1995-05-20", "腾讯科技", "高级UI设计师", "13800138000", "lixiaohong_ui"],
                ["张老三", "男", "1988-11-11", "阿里巴巴", "后端研发专家", "13911112222", "zhanglaosan_dev"],
                ["赵总", "男", "1985-08-08", "百度", "部门负责人", "13366668888", "zhaozong_baidu"]
            ];

            console.log("开始插入多条测试数据...");
            await insertFriends(testData);

        } catch (error) {
            console.error("执行出错：", error);
        }
    }
    
    runTest();
}
