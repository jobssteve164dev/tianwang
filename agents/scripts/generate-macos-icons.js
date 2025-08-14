const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 确保输出目录存在
const assetsDir = path.join(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

async function generateMacOSIcons() {
    console.log('开始生成macOS优化的图标...');
    
    try {
        // 读取SVG源文件
        const svgPath = path.join(assetsDir, 'icon.svg');
        const traySvgPath = path.join(assetsDir, 'tray-icon.svg');
        
        if (!fs.existsSync(svgPath)) {
            console.error('找不到源SVG文件:', svgPath);
            return;
        }
        
        // 生成不同尺寸的图标
        const sizes = [
            { name: 'icon-16.png', size: 16 },
            { name: 'icon-32.png', size: 32 },
            { name: 'icon-64.png', size: 64 },
            { name: 'icon-128.png', size: 128 },
            { name: 'icon-256.png', size: 256 },
            { name: 'icon-512.png', size: 512 }
        ];
        
        // 生成主图标的各种尺寸
        for (const { name, size } of sizes) {
            await sharp(svgPath)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(path.join(assetsDir, name));
            
            console.log(`✓ 生成 ${name} (${size}x${size})`);
        }
        
        // 生成托盘专用图标
        if (fs.existsSync(traySvgPath)) {
            await sharp(traySvgPath)
                .resize(32, 32, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(path.join(assetsDir, 'tray-icon.png'));
            
            console.log('✓ 生成 tray-icon.png (32x32)');
        }
        
        // 生成macOS专用的菜单栏图标
        const macosTraySvgPath = path.join(assetsDir, 'macos-tray-icon.svg');
        if (fs.existsSync(macosTraySvgPath)) {
            await sharp(macosTraySvgPath)
                .resize(18, 18, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(path.join(assetsDir, 'macos-tray-icon.png'));
            
            console.log('✓ 生成 macos-tray-icon.png (18x18)');
        }
        
        // 生成macOS专用的.icns文件
        const icnsSizes = [16, 32, 64, 128, 256, 512];
        const icnsFiles = [];
        
        for (const size of icnsSizes) {
            const tempPngPath = path.join(assetsDir, `temp-${size}.png`);
            await sharp(svgPath)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(tempPngPath);
            
            icnsFiles.push(tempPngPath);
        }
        
        // 注意：生成.icns文件需要macOS的iconutil工具
        // 这里我们只生成PNG文件，.icns文件需要手动转换或使用其他工具
        console.log('✓ 生成临时PNG文件用于.icns转换');
        
        console.log('\n🎉 macOS图标生成完成！');
        console.log('\n注意：要生成.icns文件，请使用以下命令：');
        console.log('1. 创建iconset目录');
        console.log('2. 将PNG文件重命名为对应的尺寸名称');
        console.log('3. 运行: iconutil -c icns iconset');
        
    } catch (error) {
        console.error('生成图标时出错:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    generateMacOSIcons();
}

module.exports = { generateMacOSIcons };
