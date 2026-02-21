# GitHub Pages 部署配置

## 方式一：GitHub Actions 自动部署（推荐）

将以下文件放在仓库根目录的 `.github/workflows/docs.yml`：

```yaml
name: Deploy VitePress site to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: '初始模板/脚本/galgame通用生成器/package-lock.json'
      - run: npm ci
        working-directory: '初始模板/脚本/galgame通用生成器'
      - run: npm run docs:build
        working-directory: '初始模板/脚本/galgame通用生成器'
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '初始模板/脚本/galgame通用生成器/docs/.vitepress/dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## 方式二：手动部署

```bash
# 构建
npm run docs:build

# 将 docs/.vitepress/dist 目录内容上传到你的静态托管服务
```

## 配置 base 路径

在 `docs/.vitepress/config.mts` 中修改 `base` 字段：

- 如果部署到 `https://username.github.io/`：`base: '/'`
- 如果部署到 `https://username.github.io/repo-name/`：`base: '/repo-name/'`
