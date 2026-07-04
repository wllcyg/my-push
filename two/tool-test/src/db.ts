import dotenv from 'dotenv'
dotenv.config()
import mysql from 'mysql2/promise'


class DataBase {
    private constructor(private db: mysql.Connection) { }

    // 构造函数无法 await，使用静态工厂方法来异步创建实例
    static async create() {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true
            }
        })
        return new DataBase(connection)
    }

    async query(sql: string, params?: any[]) {
        return this.db.query(sql, params)
    }
}

// 使用方式（模块级单例）：
// import { db } from '@/db.js'
// const result = await (await db).query('SELECT * FROM users')

export const db = DataBase.create()
