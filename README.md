# 伴桌

一只常驻 Windows 桌面的久坐监督宠物。

## 工作方式

- 登录 Windows 后自动启动，并从亮屏开始累计时间。
- 连续使用 55 分钟时发送系统通知，提醒保存工作。
- 连续使用 60 分钟时在全部显示器上打开置顶全屏休息页。
- 休息 10 分钟后才能继续使用。
- 锁屏或休眠不足 8 分钟，仍计入这一轮连续使用时间。
- 锁屏或休眠达到 8 分钟，本轮计时归零。
- 主窗口关闭后应用仍在系统托盘运行。

> Windows 安全界面、任务管理器及系统快捷键不受应用拦截。这是操作系统的安全边界。

## 本地运行

需要 Node.js 20 或更高版本。

```powershell
npm install
npm start
```

## 打包 Windows 安装程序

```powershell
npm run dist
```

安装程序会生成到 `release/` 目录。

## 发布到 GitHub

创建空仓库后执行：

```powershell
git remote add origin https://github.com/你的用户名/banzhu-pet.git
git branch -M main
git push -u origin main
```

## License

MIT
