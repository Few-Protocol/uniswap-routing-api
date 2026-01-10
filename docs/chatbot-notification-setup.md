# Chatbot 通知配置指南

`chatbotSNSArn` 用于将 CloudWatch 告警发送到聊天机器人（Slack 或 Telegram）。当 Lambda 函数出现错误率过高或节流时，会自动发送通知。

## 配置方式

### 方案一：使用 Slack（推荐）

使用 AWS Chatbot 服务，这是最简单的方式。

#### 步骤 1: 创建 SNS Topic

在 AWS 控制台中：

1. 进入 **SNS (Simple Notification Service)** 控制台
2. 点击 **Topics** → **Create topic**
3. 选择 **Standard** 类型
4. 输入名称，例如：`SlackChatbotTopic`
5. 点击 **Create topic**
6. 复制 **Topic ARN**（格式：`arn:aws:sns:region:account-id:SlackChatbotTopic`）

#### 步骤 2: 配置 AWS Chatbot 连接 Slack

1. 进入 **AWS Chatbot** 控制台（在 AWS 服务中搜索 "Chatbot"）
2. 点击 **Configure new client**
3. 选择 **Slack**
4. 点击 **Configure Slack workspace**（如果是首次配置）
   - 会跳转到 Slack 授权页面
   - 选择要配置的 Slack workspace
   - 授权 AWS Chatbot 访问
5. 返回 AWS Chatbot，选择已授权的 Slack workspace
6. 选择 **Public channels** 或创建新的 channel，例如：`#aws-alerts`
7. 在 **SNS topics** 部分，选择步骤 1 创建的 SNS Topic
8. 配置 IAM role：
   - 可以选择自动创建新的 role
   - 或者使用现有的 role（需要 SNS 发布权限）
9. 点击 **Configure**

#### 步骤 3: 配置环境变量

在 `.env` 文件中添加：

```bash
CHATBOT_SNS_ARN=arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:SlackChatbotTopic
```

替换 `YOUR_ACCOUNT_ID` 为你的 AWS 账户 ID，`us-east-1` 为你的 AWS 区域。

#### 步骤 4: 测试通知

在 AWS SNS 控制台：

1. 选择创建的 Topic
2. 点击 **Publish message**
3. 输入测试消息
4. 点击 **Publish**
5. 检查 Slack channel 是否收到消息

---

### 方案二：使用 Telegram

使用 Lambda 函数作为中转，将 SNS 消息转发到 Telegram Bot。

#### 步骤 1: 创建 Telegram Bot

1. 在 Telegram 中搜索 `@BotFather`
2. 发送 `/newbot` 命令
3. 按提示设置 bot 名称和用户名
4. 保存 BotFather 返回的 **Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）
5. （可选）发送 `/setprivacy` 并选择 `Disable`，以允许 bot 在群组中接收所有消息
6. 获取你的 **Chat ID**：
   - 与你的 bot 私聊，发送任意消息
   - 访问：`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - 在返回的 JSON 中找到 `"chat":{"id":123456789}`，这就是你的 Chat ID

#### 步骤 2: 创建 SNS Topic

同 Slack 方案的步骤 1。

#### 步骤 3: 创建 Lambda 函数转发消息

使用 AWS Console 或 CDK：

**使用 AWS Console：**

1. 进入 **Lambda** 控制台
2. 点击 **Create function**
3. 选择 **Author from scratch**
4. 函数名称：`TelegramNotificationForwarder`
5. 运行时：`Python 3.11` 或 `Node.js 18.x`
6. 创建函数

**Python 版本代码：**

```python
import json
import urllib.request
import urllib.parse
import os

TELEGRAM_BOT_TOKEN = os.environ['TELEGRAM_BOT_TOKEN']
TELEGRAM_CHAT_ID = os.environ['TELEGRAM_CHAT_ID']

def lambda_handler(event, context):
    try:
        # 解析 SNS 消息
        sns_message = event['Records'][0]['Sns']
        subject = sns_message.get('Subject', 'AWS Alert')
        message = sns_message.get('Message', '')
        
        # 格式化消息
        telegram_message = f"🚨 *{subject}*\n\n{message}"
        
        # 发送到 Telegram
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = {
            'chat_id': TELEGRAM_CHAT_ID,
            'text': telegram_message,
            'parse_mode': 'Markdown'
        }
        
        req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode())
        response = urllib.request.urlopen(req)
        
        return {
            'statusCode': 200,
            'body': json.dumps('Message sent to Telegram')
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        raise
```

**Node.js 版本代码：**

```javascript
const https = require('https');

exports.handler = async (event) => {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    try {
        const snsMessage = event.Records[0].Sns;
        const subject = snsMessage.Subject || 'AWS Alert';
        const message = snsMessage.Message || '';
        
        const telegramMessage = `🚨 *${subject}*\n\n${message}`;
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const data = JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: telegramMessage,
            parse_mode: 'Markdown'
        });
        
        await new Promise((resolve, reject) => {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };
            
            const req = https.request(url, options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => resolve(responseData));
            });
            
            req.on('error', reject);
            req.write(data);
            req.end();
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify('Message sent to Telegram')
        };
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};
```

7. 在 Lambda 函数配置中，添加环境变量：
   - `TELEGRAM_BOT_TOKEN`: 步骤 1 获取的 Token
   - `TELEGRAM_CHAT_ID`: 步骤 1 获取的 Chat ID

8. 添加 **SNS** 作为触发器：
   - 在函数页面，点击 **Add trigger**
   - 选择 **SNS**
   - 选择步骤 2 创建的 SNS Topic
   - 点击 **Add**

#### 步骤 4: 配置环境变量

在 `.env` 文件中添加：

```bash
CHATBOT_SNS_ARN=arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:TelegramChatbotTopic
```

#### 步骤 5: 测试通知

同 Slack 方案的步骤 4，检查 Telegram 是否收到消息。

---

## 使用已存在的 SNS Topic ARN

如果你已经有配置好的 SNS Topic（例如生产环境使用的），只需在 `.env` 文件中设置：

```bash
CHATBOT_SNS_ARN=arn:aws:sns:us-east-1:513278913266:SlackChatbotTopic
```

---

## 验证配置

部署后，当以下情况发生时，会收到通知：

1. **Lambda 错误率过高**：错误率超过 5% 持续 15 分钟
2. **Lambda 节流**：5 分钟内节流次数超过 10 次
3. **API 错误**：5xx/4xx 错误率过高
4. **API 延迟过高**
5. **其他 CloudWatch 告警**

---

## 故障排查

### Slack 没有收到消息

1. 检查 SNS Topic 是否正确配置
2. 检查 AWS Chatbot 配置是否正确连接到 Slack channel
3. 检查 Slack channel 权限，确保 AWS Chatbot bot 有权限发布消息
4. 在 SNS Topic 中查看 "Publish message" 的测试是否成功

### Telegram 没有收到消息

1. 检查 Lambda 函数的 CloudWatch Logs，查看是否有错误
2. 验证 Telegram Bot Token 和 Chat ID 是否正确
3. 检查 Lambda 函数是否有正确的环境变量
4. 确认 Lambda 函数的执行角色有 CloudWatch Logs 权限

### 查看告警配置

在代码中，告警配置在以下文件中：
- `bin/stacks/routing-lambda-stack.ts` - Lambda 错误率和节流告警
- `bin/stacks/routing-api-stack.ts` - API 错误率和延迟告警
