/**
 * 通用 SSE JSON 读取器
 * 从 SSE 流中读取数据，忽略 ping 心跳，提取最终 JSON 结果
 * 用于解决 Vercel 10s Serverless 超时问题
 */
export async function fetchSSEJSON<T = any>(
  url: string,
  options: RequestInit,
  onChunk?: (text: string) => void
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    // 如果不是 SSE 流（比如直接返回了 JSON 错误），尝试解析 JSON
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const errData = await response.json();
      throw new Error(errData.error || errData.message || `服务器返回错误: ${response.status}`);
    }
    throw new Error(`服务器返回错误: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // 如果后端返回的是普通 JSON（本地开发或非流式降级），直接解析
  if (contentType.includes('application/json')) {
    return response.json();
  }

  // SSE 流式解析
  if (!response.body) {
    throw new Error('响应体为空');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 保留不完整的最后一行

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);

        if (parsed.type === 'ping') continue; // 心跳，忽略

        if (parsed.type === 'chunk' && onChunk) {
          onChunk(parsed.content);
          continue;
        }

        if (parsed.type === 'error') {
          throw new Error(parsed.message || 'AI 调用失败');
        }

        if (parsed.type === 'result') {
          return parsed.data as T;
        }
      } catch (e: any) {
        if (e.message && !e.message.includes('JSON')) {
          throw e; // 重新抛出非 JSON 解析错误（如 type === 'error' 的情况）
        }
        // 忽略 JSON 解析错误（不完整的 chunk）
      }
    }
  }

  throw new Error('SSE 流结束但未收到最终结果');
}
