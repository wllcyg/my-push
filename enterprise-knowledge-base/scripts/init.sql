-- 1. 确保启用向量数据库扩展 (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 创建文档分类表 (kh_category)
CREATE TABLE IF NOT EXISTS kh_category (
    id BIGINT PRIMARY KEY,
    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL UNIQUE,
    remark VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 预置分类字典初始数据
INSERT INTO kh_category (id, name, code, remark) VALUES
(1001, '技术文档', 'cat_tech', '研发架构、技术方案、API 规范'),
(1002, '产品手册', 'cat_product', '产品 PRD、用户手册、功能设计'),
(1003, '人事规章', 'cat_hr', '公司规章制度、考勤与报销管理'),
(1004, '财务报表', 'cat_finance', '财务制度、预算与成本说明')
ON CONFLICT (id) DO NOTHING;

-- 3. 创建团队表 (kh_team)
CREATE TABLE IF NOT EXISTS kh_team (
    id BIGINT PRIMARY KEY,
    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL UNIQUE,
    remark VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 预置团队字典初始数据
INSERT INTO kh_team (id, name, code, remark) VALUES
(2001, '核心研发组', 'team_dev', '负责底层架构与核心业务开发'),
(2002, '产品运营组', 'team_ops', '负责产品规划与用户运营'),
(2003, '综合行政组', 'team_admin', '负责行政、HR 与财务管理')
ON CONFLICT (id) DO NOTHING;

-- 4. 创建标签字典表 (kh_tag)
CREATE TABLE IF NOT EXISTS kh_tag (
    id BIGINT PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    color VARCHAR DEFAULT '#108ee9',
    quote_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 预置标签字典初始数据
INSERT INTO kh_tag (id, name, color, quote_count) VALUES
(3001, 'DOCX', '#108ee9', 12),
(3002, 'PDF', '#f50', 8),
(3003, '架构设计', '#87d068', 15),
(3004, '周报总结', '#2db7f5', 5),
(3005, 'RAG检索', '#722ed1', 20)
ON CONFLICT (id) DO NOTHING;

-- 5. 创建文档元数据表 (kh_document)
CREATE TABLE IF NOT EXISTS kh_document (
    id BIGINT PRIMARY KEY,
    title VARCHAR NOT NULL,
    content_id VARCHAR NOT NULL UNIQUE,
    summary VARCHAR,
    category_id BIGINT,
    team_id BIGINT,
    author_id BIGINT,
    cover_image VARCHAR,
    tags VARCHAR,
    status SMALLINT NOT NULL DEFAULT 0,
    remark VARCHAR,
    view_count INT NOT NULL DEFAULT 0,
    like_count INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,
    favourite_count INT NOT NULL DEFAULT 0,
    word_count INT NOT NULL DEFAULT 0,
    publish_time TIMESTAMPTZ,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    create_by BIGINT,
    update_by BIGINT,
    deleted BOOLEAN NOT NULL DEFAULT false
);
