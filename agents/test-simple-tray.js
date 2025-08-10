const { app, Tray, Menu, nativeImage } = require('electron');

function createSimpleTray() {
    console.log('=== 创建简单菜单栏图标 ===');
    
    // 创建一个简单的图标
    const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3Njape.org5vuPBoAAAB9SURBVDiNY2AYBYMRMDIyMjAyMjL8//+f4f///wwsDAwMDP///2f4//8/AwMDA8P///8ZGBgYGP7//8/AwMDA8P//f4b///8z/P//n+H///8M////Z/j//z8DAwMDw////xn+///P8P//f4b///8z/P//n+H///8M////Z/j//z8DAwMDw////xn+//8/AAAb8QABn5Qj5QAAAABJRU5ErkJggg==');
    
    console.log('图标创建成功');
    
    // 创建托盘
    const tray = new Tray(icon);
    console.log('托盘对象创建成功');
    
    // 创建菜单
    const menu = Menu.buildFromTemplate([
        {
            label: '测试',
            click: () => {
                console.log('菜单被点击');
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
    
    // 设置菜单
    tray.setContextMenu(menu);
    tray.setToolTip('测试应用');
    
    console.log('菜单设置完成');
    console.log('菜单栏图标应该显示在顶部菜单栏中');
    
    // 双击事件
    tray.on('double-click', () => {
        console.log('托盘被双击');
    });
    
    return tray;
}

app.whenReady().then(() => {
    console.log('应用启动');
    const tray = createSimpleTray();
    
    // 5秒后退出
    setTimeout(() => {
        console.log('测试完成，退出应用');
        app.quit();
    }, 5000);
});

app.on('window-all-closed', () => {
    app.quit();
});
