#!/usr/bin/env node
/**
 * 构建脚本 - 将 CSS 合并到 JS 生成发布版
 * 用法: node build.js
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const CSS_FILE = path.join(DIR, '数据库界面插件.css');
const JS_SOURCE = path.join(DIR, '数据库界面插件.js');
const JS_DIST = path.join(DIR, '数据库界面插件.dist.js');

console.log('🔨 开始构建...');

// 检查文件是否存在
if (!fs.existsSync(CSS_FILE)) {
  console.error('❌ 错误: 找不到 CSS 文件:', CSS_FILE);
  process.exit(1);
}

if (!fs.existsSync(JS_SOURCE)) {
  console.error('❌ 错误: 找不到 JS 源文件:', JS_SOURCE);
  process.exit(1);
}

// 读取文件
const css = fs.readFileSync(CSS_FILE, 'utf8');
let js = fs.readFileSync(JS_SOURCE, 'utf8');

// 处理 CSS：转义特殊字符
const processedCss = css
  .replace(/\\/g, '\\\\')    // 转义反斜杠
  .replace(/`/g, '\\`')      // 转义反引号
  .replace(/\$/g, '\\$');    // 转义 $ 符号

// 替换占位符
if (!js.includes('__CSS_PLACEHOLDER__')) {
  console.error('❌ 错误: JS 源文件中找不到 __CSS_PLACEHOLDER__ 占位符');
  console.log('   请确保 injectStyles() 函数中的 css 变量使用了占位符');
  process.exit(1);
}

js = js.replace('__CSS_PLACEHOLDER__', processedCss);

// 写入发布文件
fs.writeFileSync(JS_DIST, js, 'utf8');

// 统计信息
const cssSize = (css.length / 1024).toFixed(1);
const jsSourceSize = (fs.statSync(JS_SOURCE).size / 1024).toFixed(1);
const jsDistSize = (js.length / 1024).toFixed(1);

console.log('✅ 构建完成!');
console.log('');
console.log('📊 文件统计:');
console.log(`   CSS 文件:     ${cssSize} KB`);
console.log(`   JS 源文件:    ${jsSourceSize} KB`);
console.log(`   JS 发布版:    ${jsDistSize} KB`);
console.log('');
console.log(`📁 输出文件: ${JS_DIST}`);
