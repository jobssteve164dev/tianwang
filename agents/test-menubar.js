const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// 测试macOS菜单栏图标
function testMenuBar() {
    console.log('=== 开始测试macOS菜单栏图标 ===');
    console.log(`当前平台: ${process.platform}`);
    console.log(`当前架构: ${process.arch}`);
    
    // 创建一个简单的图标
    const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3Njape.org5vuPBoAAAB9SURBVDiNY2AYBYMRMDIyMjAyMjL8//+f4f///wwsDAwMDP///2f4//8/AwMDA8P///8ZGBgYGP7//8/AwMDA8P//f4b///8z/P//n+H///8M////Z/j//z8DAwMDw////xn+///P8P//f4b///8z/P//n+H///8M////Z/j//z8DAwMDw////xn+//8/AAAb8QABn5Qj5QAAAABJRU5ErkJggg==');
    
    console.log('图标创建成功');
    
    const tray = new Tray(icon);
    console.log('菜单栏图标对象创建成功');
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '测试菜单项',
            click: () => {
                console.log('菜单项被点击');
            }
        },
        {
            label: '退出',
            click: () => {
                console.log('退出被点击');
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('TianWang Agent 测试');
    
    console.log('菜单栏图标设置完成');
    console.log('菜单栏图标应该显示在顶部菜单栏中');
    
    // 10秒后退出
    setTimeout(() => {
        console.log('测试完成，退出应用');
        app.quit();
    }, 10000);
}

app.whenReady().then(() => {
    console.log('应用启动');
    testMenuBar();
});

app.on('window-all-closed', () => {
    app.quit();
});
