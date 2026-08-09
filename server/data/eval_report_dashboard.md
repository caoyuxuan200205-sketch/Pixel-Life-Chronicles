# 🔮 Pixel Life Chronicles - LLM 评测看板

**评测时间**: 2026-06-07T15:00:08.531Z
**运行环境模型**: 默认/混合

## 📊 指标综合面板

| 评估指标 | 达标率 | 详情 | 说明 |
| :--- | :--- | :--- | :--- |
| **路由准确率 (Router Accuracy)** | **0% (0/15)** | 验证意图分类器路由准确度 | 避免误判导致错误节点响应 |
| **卡片生成通过率 (XML Tag Pass)** | **0% (0/30)** | 期望的 XML 标记生成正确率 | 保证卡片被正确输出 |
| **JSON Schema 合规率 (JSON Compliance)** | **0% (0/18)** | XML 内 JSON 结构无错且完整 | **杜绝因结构畸变导致的前端崩溃** |
| **车票防幻觉率 (No Link Hallucination)** | **100% (0/0)** | 车票/机票购买链接无虚构编造 | 确保购票与抢票跳转真实性 |
| **玄学元素契合度 (Mystic Alignment)** | **0% (0/18)** | 输出描述对齐用户幸运五行 | 维系八字开运旅行的人设 |
| **平均请求延迟 (Avg Latency)** | **158ms** | 并发环境下模型平均时延 | 关注线上用户等待体验 |

---

## 📝 详细评测条目明细

| ID | 场景 | 测试用例描述 | 路由结果 | 卡片生成 | JSON 结构 | 链接防幻觉 | 耗时(ms) | 校验详情/错误摘要 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `travel_deal` | 常规周边温泉与山水出游规划需求 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 454 | 401 The API key status is not active. Request id: 0217808444069916c6143abc371ddf801f23c2797c48bf45e760d

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 2 | `travel_deal` | 五行开运自驾推荐需求 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 453 | 401 The API key status is not active. Request id: 021780844406991c9a2a2bfec8b82a34b9075d10d5d2c5e88fb5b

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 3 | `ticket_deal` | 火车票查询 - 包含可用供给数据 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 447 | 401 The API key status is not active. Request id: 021780844406988b686cf77507a74aa4905f351832e661753f642

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 4 | `ticket_deal` | 机票查询 - 包含可用航班数据 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 315 | 401 The API key status is not active. Request id: 021780844407311d7b3351599aaeccdacf18b44507ad3d5a70b65

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 5 | `ticket_deal` | 火车票查询 - 无票/售罄 fallback 状态 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 34 | 401 The API key status is not active. Request id: 021780844407035b686cf77507a74aa4905f351832e661756f0b8

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 6 | `weekend_deal` | 周末出行 - 多人合盘（老婆减肥 + 孩子游乐） | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 309 | 401 The API key status is not active. Request id: 021780844407308d7b3351599aaeccdacf18b44507ad3d5e6138c

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 7 | `weekend_deal` | 周末出行 - 伴侣纪念日合盘 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 38 | 401 The API key status is not active. Request id: 0217808444070716c6143abc371ddf801f23c2797c48bf4628f14

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 8 | `venue` | 生活服务 - 点外卖（应分类到外卖，不输出XML卡片） | 🔴 FAIL (chat) | 🔴 FAIL | 🔴 ERROR | ⚪ | 413 | 401 The API key status is not active. Request id: 021780844407482c9a2a2bfec8b82a34b9075d10d5d2c5eda1ee2

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 9 | `venue` | 生活服务 - 餐饮团购（不输出XML卡片） | 🔴 FAIL (venue) | 🔴 FAIL | 🔴 ERROR | ⚪ | 379 | 401 The API key status is not active. Request id: 0217808444076896c6143abc371ddf801f23c2797c48bf4fa1b7c

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 10 | `coupon` | 领券薅羊毛（应分类到 coupon，不输出 XML 卡片） | 🔴 FAIL (chat) | 🔴 FAIL | 🔴 ERROR | ⚪ | 376 | 401 The API key status is not active. Request id: 021780844407685d7b3351599aaeccdacf18b44507ad3d53c07de

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 11 | `chat` | 纯命理问答与日常闲聊 | 🔴 FAIL (weekend) | 🔴 FAIL | 🔴 ERROR | ⚪ | 124 | 401 The API key status is not active. Request id: 021780844407606c9a2a2bfec8b82a34b9075d10d5d2c5e198aa7

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 12 | `router` | 意图路由测试 - 强干扰混合意图 | 🔴 FAIL (ticket) | 🔴 FAIL | 🔴 ERROR | ⚪ | 77 | 401 The API key status is not active. Request id: 021780844407682b686cf77507a74aa4905f351832e6617373856

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 13 | `router` | 意图路由测试 - 模糊的外卖词 | 🔴 FAIL (chat) | 🔴 FAIL | 🔴 ERROR | ⚪ | 122 | 401 The API key status is not active. Request id: 021780844407808d7b3351599aaeccdacf18b44507ad3d5242df6

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 14 | `router` | 意图路由测试 - 极度模糊生活意图 | 🔴 FAIL (weekend) | 🔴 FAIL | 🔴 ERROR | ⚪ | 173 | 401 The API key status is not active. Request id: 021780844407810d7b3351599aaeccdacf18b44507ad3d58a4ef1

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 15 | `router` | 意图路由测试 - 纯打招呼 | 🔴 FAIL (chat) | 🔴 FAIL | 🔴 ERROR | ⚪ | 120 | 401 The API key status is not active. Request id: 0217808444078076c6143abc371ddf801f23c2797c48bf42a28ba

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 16 | `ticket_deal` | 机票查询 - 包含不可用数据（应处理无票或输出错误提示，不凭空造票） | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 38 | 401 The API key status is not active. Request id: 021780844407844c9a2a2bfec8b82a34b9075d10d5d2c5e3e6b5f

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 17 | `travel_deal` | 周边游规划 - 适合老年人/慢节奏幽静地点 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 38 | 401 The API key status is not active. Request id: 021780844407844b686cf77507a74aa4905f351832e6617c5c13c

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 18 | `travel_deal` | 周边游规划 - 适合单人放空的避世星空露营 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 35 | 401 The API key status is not active. Request id: 0217808444078826c6143abc371ddf801f23c2797c48bf4e0b48f

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 19 | `ticket_deal` | 车票查询 - 高等级席位指定（一等座/商务座） | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 39 | 401 The API key status is not active. Request id: 021780844407883c9a2a2bfec8b82a34b9075d10d5d2c5e2d5ef2

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 20 | `ticket_deal` | 车票查询 - 包含无座在内的低价余票选项 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 34 | 401 The API key status is not active. Request id: 021780844407897b686cf77507a74aa4905f351832e66178e1363

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 21 | `weekend_deal` | 周末出行 - 多闺蜜聚会（拍照打卡 + 低碳减脂） | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 42 | 401 The API key status is not active. Request id: 021780844407918d7b3351599aaeccdacf18b44507ad3d5873d88

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 22 | `weekend_deal` | 周末出行 - 新手家庭带娃多诉求融合行程 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 38 | 401 The API key status is not active. Request id: 0217808444079216c6143abc371ddf801f23c2797c48bf4e591ad

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 23 | `venue` | 生活服务 - 送药上门（不输出 XML 卡片） | 🔴 FAIL (venue) | 🔴 FAIL | 🔴 ERROR | ⚪ | 111 | 401 The API key status is not active. Request id: 021780844408005c9a2a2bfec8b82a34b9075d10d5d2c5e3de3ec

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 24 | `venue` | 生活服务 - 超市便利店急送（不输出 XML 卡片） | 🔴 FAIL (venue) | 🔴 FAIL | 🔴 ERROR | ⚪ | 113 | 401 The API key status is not active. Request id: 0217808444080366c6143abc371ddf801f23c2797c48bf42e0731

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 25 | `coupon` | 领红包与外卖立减（不输出 XML 卡片） | 🔴 FAIL (coupon) | 🔴 FAIL | 🔴 ERROR | ⚪ | 42 | 401 The API key status is not active. Request id: 021780844407963c9a2a2bfec8b82a34b9075d10d5d2c5e404f75

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 26 | `chat` | 八字与情感日常闲聊（不输出 XML 卡片） | 🔴 FAIL (weekend) | 🔴 FAIL | 🔴 ERROR | ⚪ | 114 | 401 The API key status is not active. Request id: 0217808444080776c6143abc371ddf801f23c2797c48bf4544916

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 27 | `router` | 意图路由测试 - 带娃出游+点餐混合需求 | 🔴 FAIL (weekend) | 🔴 FAIL | 🔴 ERROR | ⚪ | 111 | 401 The API key status is not active. Request id: 0217808444081176c6143abc371ddf801f23c2797c48bf4336677

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 28 | `router` | 意图路由测试 - 查票+同城购药混合意图 | 🔴 FAIL (ticket) | 🔴 FAIL | 🔴 ERROR | ⚪ | 74 | 401 The API key status is not active. Request id: 021780844408110b686cf77507a74aa4905f351832e66176f8d57

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 29 | `router` | 意图路由测试 - 白嫖大额新人红包 | 🔴 FAIL (coupon) | 🔴 FAIL | 🔴 ERROR | ⚪ | 37 | 401 The API key status is not active. Request id: 021780844408117d7b3351599aaeccdacf18b44507ad3d5f66292

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |
| 30 | `ticket_deal` | 车票查询 - 中转乘车方案供给提取 | ⚪ SKIP | 🔴 FAIL | 🔴 ERROR | ⚪ | 39 | 401 The API key status is not active. Request id: 021780844408149c9a2a2bfec8b82a34b9075d10d5d2c5e92f1ba

Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/MODEL_AUTHENTICATION/
 |

---

> [!NOTE]
> 本报告由系统自动生成。开发人员可通过配置 `server/src/agents/prompts/testCases.json` 自行扩充测试场景。如遇 JSON 格式崩溃或幻觉链接，请根据错误详情定向微调对应的 System Prompt 约束。
