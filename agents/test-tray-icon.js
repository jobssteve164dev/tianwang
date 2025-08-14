const path = require('path');
const fs = require('fs');

// 测试托盘图标文件
function testTrayIcon() {
    console.log('=== 测试托盘图标文件 ===');
    
    // 根据操作系统选择合适的图标
    let iconPath;
    if (process.platform === 'darwin') {
        // macOS 使用专用的菜单栏图标
        iconPath = path.join(__dirname, 'assets/macos-tray-icon.png');
        console.log('macOS 使用图标:', iconPath);
    } else {
        // 其他平台使用标准图标
        iconPath = path.join(__dirname, 'assets/tray-icon.png');
        console.log('其他平台使用图标:', iconPath);
    }
    
    // 检查图标文件是否存在
    if (!fs.existsSync(iconPath)) {
        console.error('❌ 图标文件不存在:', iconPath);
        return;
    }
    
    console.log('✅ 图标文件存在');
    
    // 获取文件信息
    const stats = fs.statSync(iconPath);
    console.log('文件大小:', stats.size, '字节');
    
    // 检查文件是否可读
    try {
        fs.accessSync(iconPath, fs.constants.R_OK);
        console.log('✅ 文件可读');
    } catch (error) {
        console.error('❌ 文件不可读:', error.message);
        return;
    }
    
    // 列出所有图标文件
    console.log('\n=== 所有图标文件 ===');
    const assetsDir = path.join(__dirname, 'assets');
    const files = fs.readdirSync(assetsDir);
    files.forEach(file => {
        if (file.match(/\.(png|svg|icns)$/)) {
            const filePath = path.join(assetsDir, file);
            const fileStats = fs.statSync(filePath);
            console.log(`${file}: ${fileStats.size} 字节`);
        }
    });
    
    console.log('\n=== 测试完成 ===');
}

// 如果直接运行此脚本
if (require.main === module) {
    testTrayIcon();
}

module.exports = { testTrayIcon };
