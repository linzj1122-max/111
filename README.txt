这是接真实 API 的 Netlify Functions 项目版。

不要用 Netlify Drop 直接拖拽这个包来接 API。
正确方式：上传到 GitHub，然后在 Netlify 里 Import from Git。

Netlify Build settings:
Build command: npm run build
Publish directory: .
Functions directory: netlify/functions

环境变量：
OZON_CLIENT_ID
OZON_API_KEY
OZON_STORE_NAME

部署成功后测试：
/.netlify/functions/api/health
/api/health
/api/debug
/api/orders
