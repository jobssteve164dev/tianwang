const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createIcons() {
    console.log('🎨 开始创建应用图标...');
    
    const assetsDir = path.join(__dirname, 'assets');
    const svgPath = path.join(assetsDir, 'icon.svg');
    
    if (!fs.existsSync(svgPath)) {
        console.error('❌ SVG图标文件不存在:', svgPath);
        return;
    }
    
    try {
        // 读取SVG文件
        const svgBuffer = fs.readFileSync(svgPath);
        
        // 创建不同尺寸的PNG图标
        const sizes = [16, 32, 64, 128, 256, 512];
        const pngFiles = [];
        
        for (const size of sizes) {
            const pngPath = path.join(assetsDir, `icon-${size}.png`);
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(pngPath);
            pngFiles.push(pngPath);
            console.log(`✅ 创建 ${size}x${size} PNG图标`);
        }
        
        // 创建主要的PNG图标（256x256）
        const mainPngPath = path.join(assetsDir, 'icon.png');
        await sharp(svgBuffer)
            .resize(256, 256)
            .png()
            .toFile(mainPngPath);
        console.log('✅ 创建主PNG图标');
        
        // 创建托盘图标（32x32）
        const trayPngPath = path.join(assetsDir, 'tray-icon.png');
        await sharp(svgBuffer)
            .resize(32, 32)
            .png()
            .toFile(trayPngPath);
        console.log('✅ 创建托盘图标');
        
        // 创建警告图标（32x32）
        const warningSvgPath = path.join(assetsDir, 'warning-icon.svg');
        if (fs.existsSync(warningSvgPath)) {
            const warningSvgBuffer = fs.readFileSync(warningSvgPath);
            const warningPngPath = path.join(assetsDir, 'warning-icon.png');
            await sharp(warningSvgBuffer)
                .resize(32, 32)
                .png()
                .toFile(warningPngPath);
            console.log('✅ 创建警告图标');
        }
        
        // 创建.icns文件（macOS应用图标）
        // 注意：在macOS上，我们可以使用iconutil命令来创建.icns文件
        // 但为了简化，我们先创建一个基本的.icns文件
        console.log('✅ 图标创建完成！');
        console.log('📁 图标文件位置:', assetsDir);
        
        // 提示用户如何创建.icns文件
        console.log('');
        console.log('💡 要创建.icns文件，请在macOS上运行以下命令：');
        console.log('   mkdir icon.iconset');
        console.log('   cp assets/icon-16.png icon.iconset/icon_16x16.png');
        console.log('   cp assets/icon-32.png icon.iconset/icon_16x16@2x.png');
        console.log('   cp assets/icon-32.png icon.iconset/icon_32x32.png');
        console.log('   cp assets/icon-64.png icon.iconset/icon_32x32@2x.png');
        console.log('   cp assets/icon-128.png icon.iconset/icon_128x128.png');
        console.log('   cp assets/icon-256.png icon.iconset/icon_128x128@2x.png');
        console.log('   cp assets/icon-256.png icon.iconset/icon_256x256.png');
        console.log('   cp assets/icon-512.png icon.iconset/icon_256x256@2x.png');
        console.log('   cp assets/icon-512.png icon.iconset/icon_512x512.png');
        console.log('   cp assets/icon-512.png icon.iconset/icon_512x512@2x.png');
        console.log('   iconutil -c icns icon.iconset -o assets/icon.icns');
        console.log('   rm -rf icon.iconset');
        
    } catch (error) {
        console.error('❌ 创建图标失败:', error);
    }
}

createIcons();
