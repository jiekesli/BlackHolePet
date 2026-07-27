# v1.9 独立重写记录

## 原因

早期版本在 `Myantion/Cosmic` 源码上继续修改，而该仓库没有声明开源许可证。
为使本项目能够在 MIT 许可证下发布，v1.9 不再提交或构建早期继承文件。

## 功能规格来源

重写只沿用用户可观察的产品需求：

- 透明且始终置顶的 Windows 桌宠
- 局部黑洞后景折射和动态吸积盘
- 三种观察形态
- 鼠标引力与单一扭曲光标
- 文件进入回收站及吸入动画
- 托盘、设置持久化和性能模式

## 新架构

- `blackhole.js` 使用新的全屏三角形 WebGL2 管线、解析式吸积盘场、
  径向偏折场和旋涡位移场。
- `main.js` 使用新的偏好设置、显示器坐标、窗口切换、回收站保护和原生助手
  生命周期设计。
- `app-config.js` 集中处理外部输入校验和渲染负载。
- `preload.js` 与 `settings-preload.js` 只暴露白名单 IPC。
- 设置页面和桌宠页面全部重新编排。

## 文件替换

以下早期继承文件已被删除：

- `renderer.js`
- `index.html`
- `settings-defaults.js`
- `settings-renderer.js`

对应新文件：

- `blackhole.js`
- `blackhole.html`
- `app-config.js`
- `settings.js`

`main.js`、`preload.js`、`settings.html` 和 `settings-preload.js` 已整体重写。

## 相似度复核

使用逐行最长公共连续片段审计：

- 上游 `renderer.js` 与新 `blackhole.js`：最长相同片段 6 行，为标准
  `createShader / shaderSource / compileShader` WebGL API 调用。
- 上游 `main.js` 与新 `main.js`：最长相同片段 9 行，为标准 Electron
  `BrowserWindow.webPreferences` 配置。

未发现来自上游的着色器公式、交互算法或业务函数连续代码块。

## 验证

- Node 配置单元测试
- 所有 JavaScript 文件语法检查
- 黑洞三种形态实机截图检查
- 透明边缘与局部后景折射检查
- 文件移动到 Windows 回收站烟雾测试
- 奶龙资源加载、方向注视和窗口移动 IPC 测试
- electron-builder 绿色版与 NSIS 构建检查
