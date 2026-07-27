# 黑洞桌宠

开发者：**凌晨曦**

一款面向 Windows 10/11 的透明桌面宠物。v1.9 起，黑洞渲染、Electron
主进程、IPC 与设置界面均采用独立架构重新实现，项目代码使用 MIT 许可证。

## 功能

- 独立 WebGL2 黑洞着色器：动态吸积盘、事件视界、光子环和局部引力透镜
- 三种黑洞观察形态，可通过双击或托盘菜单切换
- 后景扭曲限制在桌宠窗口内，透明渐变融入桌面
- 单一自定义扭曲光标与可调节的 Windows 原生鼠标引力
- 文件沿压缩旋转轨迹进入黑洞，成功后移动到 Windows 回收站
- 吞入文件后黑洞平滑成长，重启或清空回收站后恢复
- 奶龙动画方案：待机、跑动、挥手、跳跃、等待、委屈和方向注视
- 托盘菜单在黑洞与奶龙之间切换，并自动保存选择
- 自动、高画质、均衡、低功耗四档性能模式
- `Ctrl+Alt+B` 全局显示/隐藏快捷键

## 下载

不想配置开发环境，可直接前往
[Releases](https://github.com/jiekesli/BlackHolePet/releases) 下载 Windows 绿色版。

下载 `黑洞桌宠-v（最新）-win-x64.zip`，完整解压后双击 `黑洞桌宠.exe` 即可运行。

## 从源码运行

环境要求：

- Windows 10 / 11 x64
- Node.js 18 或更高版本
- 支持 WebGL2 的显卡与驱动
- 系统自带 .NET Framework 4.x C# 编译器

```powershell
git clone https://github.com/jiekesli/BlackHolePet.git
cd BlackHolePet
npm install
npm start
```

首次启动黑洞方案时，程序会抓取当前显示器画面，作为局部透镜的后景纹理。

## 构建

国内网络可先配置镜像：

```powershell
$env:npm_config_registry="https://registry.npmmirror.com"
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"

npm install
npm test
npm run check
npm run build
```

构建结果位于 `dist/`：

- `黑洞桌宠 Setup 1.9.0.exe`：安装包
- `win-unpacked/黑洞桌宠.exe`：绿色版入口

## 使用

| 操作 | 效果 |
| --- | --- |
| 拖动桌宠 | 移动位置 |
| 双击黑洞 | 切换观察形态 |
| 拖入普通文件 | 播放吸入动画并移至回收站 |
| 托盘 → 桌宠方案 | 切换黑洞 / 奶龙 |
| 托盘 → 设置 | 调整大小、颜色、引力和性能 |
| `Ctrl+Alt+B` | 全局显示 / 隐藏 |

> 文件吸入操作会调用 Windows 回收站。系统目录、程序目录、磁盘根目录会被拒绝。

## 架构

```text
BlackHolePet/
├── main.js                 # 窗口、托盘、桌面捕获、回收站和原生助手
├── app-config.js           # 偏好设置校验与窗口尺寸
├── preload.js              # 桌宠最小权限 IPC 桥
├── blackhole.html
├── blackhole.js            # 独立 WebGL2 黑洞与交互实现
├── pet.html
├── pet-renderer.js         # 奶龙动画图集播放器
├── settings.html
├── settings.js
├── settings-preload.js
├── native/
│   ├── GravityHelper.cs    # Windows 鼠标引力与回收站状态
│   └── GravityHelper.manifest
├── scripts/build-native.ps1
└── tests/config.test.js
```

## 独立重写说明

本项目早期曾使用 `Myantion/Cosmic` 作为实现起点。由于该仓库没有开源
许可证，v1.9 删除了继承文件，并依据功能需求重新设计主进程、渲染器、
预加载层和设置界面。审计方法和结果见
[docs/CLEAN_ROOM_REWRITE.md](docs/CLEAN_ROOM_REWRITE.md)。

Cosmic 仍作为最初的视觉与产品方向参考，在此致谢：
[Myantion/Cosmic](https://github.com/Myantion/Cosmic)。

## 许可证

程序代码使用 [MIT License](LICENSE)。

`assets/nailong/spritesheet.webp` 是角色美术资源，不属于 MIT 代码授权范围；
详见 [ASSET-LICENSE.md](ASSET-LICENSE.md)。第三方依赖继续遵循各自许可证。

## 赞赏

<img width="480" alt="赞赏码" src="https://github.com/user-attachments/assets/5b451cea-894f-4cad-bab6-20e9d609ebab" />
