const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== 中间件 =====
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== API 密钥（绝不暴露给前端）=====
const API_KEYS = {
  deepseek: process.env.DEEPSEEK_API_KEY || 'sk-98c22acea7014c3b96b70a9f6d2c2bd6',
  pollinations: process.env.POLLINATIONS_KEY || 'sk_jfVoDJ6sWGJxMBYFzgHzpoX9Uql4f10Z',
  mimo: process.env.MIMO_API_KEY || 'sk-cava4rihb82mgzp8yipv7nnsfxit6j2tvfrhmglgdn82zs39',
  glm: process.env.GLM_API_KEY || 'c265503f8bea4905a3ec719cb57f59e8.PnGRuqRHS9WmHVw2',
  tavily: process.env.TAVILY_API_KEY || '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'
};

const API_URLS = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  pollinations: 'https://gen.pollinations.ai/v1/chat/completions',
  mimo: 'https://api.xiaomimimo.com/v1/chat/completions',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  pollinationsImage: 'https://gen.pollinations.ai/image/',
  tavily: 'https://api.tavily.com/search'
};

// ===== 邀请码 =====
const INVITE_CODE = 'yyw001160';
const ADMIN_CODE = '1a2a3a4a';

// ===== 内存数据存储 =====
const sessions = new Map(); // sessionId -> { role, userId, createdAt, messageCount, chatHistory: [] }
const users = new Map();    // userId -> { totalMessages, totalImages, firstSeen, lastActive, chatHistory: [] }
const announcements = [];   // { id, content, createdAt }

// 生成简单ID
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// 认证中间件
function authMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: '未授权，请先输入邀请码' });
  }
  const session = sessions.get(sessionId);
  req.session = session;
  req.sessionId = sessionId;
  next();
}

// ===== 路由 =====

// --- 邀请码验证 ---
app.post('/api/auth', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: '请输入邀请码' });

  const sessionId = genId();
  const userId = genId();

  if (code === ADMIN_CODE) {
    sessions.set(sessionId, {
      role: 'admin',
      userId,
      createdAt: new Date().toISOString(),
      messageCount: 0
    });
    users.set(userId, {
      role: 'admin',
      totalMessages: 0,
      totalImages: 0,
      firstSeen: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      chatHistory: []
    });
    return res.json({ sessionId, role: 'admin', message: '管理员登录成功' });
  }

  if (code === INVITE_CODE) {
    sessions.set(sessionId, {
      role: 'user',
      userId,
      createdAt: new Date().toISOString(),
      messageCount: 0
    });
    users.set(userId, {
      role: 'user',
      totalMessages: 0,
      totalImages: 0,
      firstSeen: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      chatHistory: []
    });
    return res.json({ sessionId, role: 'user', message: '邀请码验证成功' });
  }

  return res.status(403).json({ error: '邀请码错误' });
});

// --- 获取公告 ---
app.get('/api/announcements', (req, res) => {
  const latest = announcements.slice(-5).reverse();
  res.json({ announcements: latest });
});

// --- 管理员：发布公告 ---
app.post('/api/admin/announcement', authMiddleware, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '公告内容不能为空' });
  }
  const ann = {
    id: genId(),
    content: content.trim(),
    createdAt: new Date().toISOString()
  };
  announcements.push(ann);
  res.json({ success: true, announcement: ann });
});

// --- 管理员：获取所有用户数据 ---
app.get('/api/admin/users', authMiddleware, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  const userList = [];
  users.forEach((data, userId) => {
    userList.push({
      userId,
      role: data.role,
      totalMessages: data.totalMessages,
      totalImages: data.totalImages,
      firstSeen: data.firstSeen,
      lastActive: data.lastActive,
      messageCount: data.chatHistory.length
    });
  });
  res.json({ users: userList });
});

// --- 管理员：获取某用户的聊天记录 ---
app.get('/api/admin/users/:userId/chats', authMiddleware, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  const user = users.get(req.params.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ chats: user.chatHistory });
});

// --- 管理员：获取统计数据 ---
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  let totalUsers = 0, totalMessages = 0, totalImages = 0, adminCount = 0;
  users.forEach(u => {
    if (u.role === 'admin') adminCount++;
    else totalUsers++;
    totalMessages += u.totalMessages;
    totalImages += u.totalImages;
  });
  res.json({
    totalUsers,
    adminCount,
    totalMessages,
    totalImages,
    activeSessions: sessions.size,
    announcements: announcements.length
  });
});

// --- API 代理：聊天 ---
app.post('/api/proxy/chat', authMiddleware, async (req, res) => {
  const { provider, body, stream } = req.body;
  
  const validProviders = ['deepseek', 'pollinations', 'mimo', 'glm'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: '无效的API提供商' });
  }

  // 记录用户用量
  const user = users.get(req.session.userId);
  if (user) {
    user.lastActive = new Date().toISOString();
    user.totalMessages++;
    
    // 记录聊天历史（只存用户消息，不存完整AI回复以节省内存）
    const lastMsg = body.messages?.[body.messages.length - 1];
    if (lastMsg) {
      user.chatHistory.push({
        timestamp: new Date().toISOString(),
        role: lastMsg.role,
        content: typeof lastMsg.content === 'string' 
          ? lastMsg.content.slice(0, 500) 
          : '[多模态消息]',
        model: body.model || provider
      });
      // 限制历史记录长度
      if (user.chatHistory.length > 200) {
        user.chatHistory = user.chatHistory.slice(-200);
      }
    }
  }

  req.session.messageCount++;

  const apiUrl = API_URLS[provider];
  const apiKey = API_KEYS[provider];

  try {
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    };

    if (stream) {
      // 流式代理
      const upstream = await fetch(apiUrl, fetchOptions);
      if (!upstream.ok) {
        let errDetail = '';
        try { const errJson = await upstream.json(); errDetail = errJson?.error?.message || JSON.stringify(errJson); }
        catch { try { errDetail = await upstream.text(); } catch {} }
        return res.status(upstream.status).json({ error: `上游API错误: ${errDetail}` });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      upstream.body.pipe(res);
    } else {
      const upstream = await fetch(apiUrl, fetchOptions);
      if (!upstream.ok) {
        let errDetail = '';
        try { const errJson = await upstream.json(); errDetail = errJson?.error?.message || JSON.stringify(errJson); }
        catch { try { errDetail = await upstream.text(); } catch {} }
        return res.status(upstream.status).json({ error: `上游API错误: ${errDetail}` });
      }
      const data = await upstream.json();
      res.json(data);
    }
  } catch (err) {
    console.error('代理请求失败:', err.message);
    res.status(500).json({ error: `代理请求失败: ${err.message}` });
  }
});

// --- API 代理：生图 ---
app.get('/api/proxy/image', authMiddleware, async (req, res) => {
  const { prompt, model, seed } = req.query;
  
  if (!prompt) return res.status(400).json({ error: '缺少图片提示词' });

  // 记录用量
  const user = users.get(req.session.userId);
  if (user) {
    user.totalImages++;
    user.lastActive = new Date().toISOString();
  }

  const imgUrl = `${API_URLS.pollinationsImage}${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed || (Date.now() % 2147483647)}&model=${model || 'grok-imagine'}&nologo=true&key=${API_KEYS.pollinations}`;

  try {
    const upstream = await fetch(imgUrl, {
      headers: { 'Accept': 'image/*' },
      timeout: 90000
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `生图API错误: HTTP ${upstream.status}` });
    }
    const contentType = upstream.headers.get('content-type');
    res.setHeader('Content-Type', contentType || 'image/png');
    upstream.body.pipe(res);
  } catch (err) {
    console.error('生图代理失败:', err.message);
    res.status(500).json({ error: `生图代理失败: ${err.message}` });
  }
});

// --- API 代理：维基百科 ---
app.get('/api/proxy/wiki', authMiddleware, async (req, res) => {
  const { keyword, lang = 'zh' } = req.query;
  if (!keyword) return res.status(400).json({ error: '缺少关键词' });

  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(keyword)}&prop=extracts&exintro=1&format=json&origin=*&redirects=1`;
  try {
    const upstream = await fetch(url, { timeout: 8000 });
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `维基百科查询失败: ${err.message}` });
  }
});

// --- API 代理：Tavily 搜索 ---
app.post('/api/proxy/search', authMiddleware, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: '缺少搜索关键词' });

  try {
    const upstream = await fetch(API_URLS.tavily, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: API_KEYS.tavily,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true
      }),
      timeout: 10000
    });
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `搜索代理失败: ${err.message}` });
  }
});

// --- API 代理：天气 ---
app.get('/api/proxy/weather', authMiddleware, async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: '缺少城市名' });

  try {
    const upstream = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%l:+%c+%t+%w+%h&lang=zh`, {
      timeout: 8000
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', 'text/plain');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: `天气查询失败: ${err.message}` });
  }
});

// --- API 代理：推文 ---
app.get('/api/proxy/tweet/:tweetId', authMiddleware, async (req, res) => {
  const { tweetId } = req.params;
  try {
    const upstream = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, { timeout: 10000 });
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `推文获取失败: ${err.message}` });
  }
});

// --- 健康检查 ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- 所有其他路由返回前端 ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 ChatYyt 代理服务运行在端口 ${PORT}`);
  console.log(`📋 邀请码: ${INVITE_CODE} | 管理员码: ${ADMIN_CODE}`);
});
