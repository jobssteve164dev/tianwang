const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'agents/scripts/build.js');

console.log('读取文件: ' + filePath);
let content = fs.readFileSync(filePath, 'utf-8');

// 1. 定位并提取页脚
const footerRegex = /\s*<div class="footer">[\s\S]*?<\/div>/;
const footerMatch = content.match(footerRegex);

if (!footerMatch) {
    console.error('错误：未找到页脚代码块！');
    process.exit(1);
}

const footerHtml = footerMatch[0];
console.log('已提取页脚HTML');

// 2. 从原位置删除页脚
content = content.replace(footerRegex, '');
console.log('已从原位置删除页脚');

// 3. 定位插入点
const insertionPoint = / {8}<\/div>\s* {4}<\/div>\s*\n\s*<script>/;
const match = content.match(insertionPoint);


if (!match) {
    console.error('错误：未找到插入点！');
    process.exit(1);
}

const replacement = '        </div>' + footerHtml + '\\n    </div>\\n\\n    <script>';

// 4. 在新位置插入页脚
content = content.replace(insertionPoint, replacement);
console.log('已在正确位置插入页脚');

// 5. 写回文件
fs.writeFileSync(filePath, content, 'utf-8');
console.log('✅ 文件修改成功！');
