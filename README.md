# ChatYyt 后端代理版

## 本地运行

```bash
cd ChatYyt-proxy
npm install
npm start
```

打开 http://localhost:3000

## 邀请码

- 普通用户：`yyw001160`
- 管理员：`1a2a3a4a`

## Railway 部署

1. 把整个 `ChatYyt-proxy` 文件夹推到 GitHub 仓库
2. 在 Railway 中 New Project → Deploy from GitHub repo
3. 选择该仓库
4. Railway 会自动检测 Node.js 并运行 `npm install` + `npm start`
5. （可选）在 Railway Variables 中设置环境变量：
   - `DEEPSEEK_API_KEY`
   - `POLLINATIONS_KEY`
   - `MIMO_API_KEY`
   - `GLM_API_KEY`
   - `TAVILY_API_KEY`
   - `PORT`（Railway 会自动设置）

## 架构

```
用户浏览器
    ↓ 邀请码登录
    ↓ /api/auth 验证
    ↓ 获得 sessionId
    ↓ 携带 x-session-id 请求
后端 Express 服务
    ↓ 代理转发（带上API密钥）
各AI服务商（DeepSeek/Pollinations/Mimo/GLM/Tavily等）
```

## 管理员功能

- 查看所有用户统计（消息数、图片数、活跃时间）
- 查看任意用户聊天记录
- 发布全局公告（所有用户打开网站可见）
