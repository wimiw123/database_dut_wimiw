# 校园二手交易平台数据库系统

本项目根据《26 数据库大作业》要求实现了一个可部署为静态网站的数据库课程作业成品。站点包含首页、商品列表页、用户列表页、订单列表页和查询分析页，数据库采用浏览器内 SQLite，所有增删改查和购买事务都会真实写入数据库并持久化。

在线访问地址：

```text
https://wimiw123.github.io/database_dut_wimiw/
```

## 项目特点

- 满足题目要求的三张表：`user`、`item`、`orders`
- 包含给定初始数据、视图、基础查询、连接查询、聚合查询
- 支持新增商品、修改价格、删除未售商品、购买商品
- 刷新页面后数据仍然保留
- 适合直接部署到 GitHub Pages、Netlify 等静态托管平台

## 本地预览

在项目根目录执行：

```bash
python -m http.server 8000
```

然后访问：

```text
http://127.0.0.1:8000/index.html
```

## 项目结构

```text
.
├── index.html
├── items.html
├── users.html
├── orders.html
├── analysis.html
├── assets
│   ├── css/styles.css
│   ├── js/db.js
│   ├── js/main.js
│   └── vendor/sql-wasm.*
├── sql
│   ├── schema.sql
│   ├── seed.sql
│   ├── views.sql
│   └── queries.sql
├── docs/项目说明.md
└── scripts/validate_project.py
```

## 自检

可执行：

```bash
python scripts/validate_project.py
```

该脚本会用本地 SQLite 对 SQL 脚本进行一次完整校验。

如果本机已装好无头浏览器运行环境，还可以执行：

```bash
python scripts/capture_screenshots.py
```

用于自动生成页面截图到 `docs/screenshots/` 目录。

## 提交建议

- 代码压缩包：直接打包当前项目目录
- 项目说明：使用 [docs/项目说明.md](/home/wimiw/database-work/docs/项目说明.md)
- 在线网址：将本项目部署到静态平台后，把网址填到说明文档顶部
- 视频：录屏从进入网址开始，依次演示四个页面和增删改查/购买/查询分析
