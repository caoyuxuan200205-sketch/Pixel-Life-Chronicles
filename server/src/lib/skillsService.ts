import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const AUTH_FILE = path.join(os.homedir(), '.xiaomei-workspace', 'auth_tokens.json');
const BIND_FILE = path.join(os.homedir(), '.xiaomei-workspace', 'venue_bind.json');

// Helper to generate device_token
function generateDeviceToken(seed: string): string {
  const tsMs = Date.now();
  const randInt = Math.floor(Math.random() * 1001);
  const raw = `${seed}${tsMs}${randInt}`;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex');
}

// Storage Helpers
function loadAuth(): any {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[skillsService] Error loading auth file:', e);
  }
  return {};
}

function saveAuth(data: any) {
  try {
    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[skillsService] Error saving auth file:', e);
  }
}

function loadBind(): any {
  try {
    if (fs.existsSync(BIND_FILE)) {
      return JSON.parse(fs.readFileSync(BIND_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[skillsService] Error loading bind file:', e);
  }
  return {};
}

function saveBind(data: any) {
  try {
    const dir = path.dirname(BIND_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BIND_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[skillsService] Error saving bind file:', e);
  }
}

// ── Coupon Auth Implementations ───────────────────────────────────────
async function handleCouponAuth(command: string, args: string[]): Promise<any> {
  const AUTH_KEY = "meituan-c-user-auth";
  
  if (command === 'status') {
    const auth = loadAuth();
    const tokenData = auth[AUTH_KEY] || {};
    const userToken = tokenData.user_token || "";
    const deviceToken = tokenData.device_token || "";
    const phoneMasked = tokenData.phone_masked || "";
    
    if (userToken) {
      return {
        success: true,
        valid: true,
        user_token: userToken,
        device_token: deviceToken,
        phone_masked: phoneMasked,
        check_mode: "local"
      };
    } else {
      return {
        success: true,
        valid: false,
        reason: "no_token",
        device_token: deviceToken,
        phone_masked: phoneMasked,
        check_mode: "local"
      };
    }
  }
  
  if (command === 'token-verify') {
    const auth = loadAuth();
    const tokenData = auth[AUTH_KEY] || {};
    const userToken = tokenData.user_token || "";
    const phoneMasked = tokenData.phone_masked || "";
    
    let deviceToken = tokenData.device_token || "";
    if (!deviceToken) {
      deviceToken = generateDeviceToken(phoneMasked || "unknown");
      tokenData.device_token = deviceToken;
      auth[AUTH_KEY] = tokenData;
      saveAuth(auth);
    }
    
    if (!userToken) {
      return {
        success: true,
        valid: false,
        reason: "no_token",
        device_token: deviceToken,
        phone_masked: phoneMasked,
        check_mode: "remote"
      };
    }
    
    try {
      const response = await axios.post(
        'https://peppermall.meituan.com/eds/claw/login/token/verify',
        null,
        {
          params: { token: userToken },
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "X-Requested-With": "XMLHttpRequest",
          },
          timeout: 10000
        }
      );
      
      const code = response.data.code;
      if (code === 0) {
        return {
          success: true,
          valid: true,
          user_token: userToken,
          device_token: deviceToken,
          phone_masked: phoneMasked,
          check_mode: "remote"
        };
      } else if (code === 20005) {
        // Clear user token
        tokenData.user_token = "";
        auth[AUTH_KEY] = tokenData;
        saveAuth(auth);
        return {
          success: true,
          valid: false,
          reason: "token_expired_or_invalid",
          device_token: deviceToken,
          phone_masked: phoneMasked,
          check_mode: "remote",
          message: response.data.message || "用户未登录或 Token 已过期，请重新登录"
        };
      } else {
        return {
          success: false,
          error: "TOKEN_VERIFY_ERROR",
          code: code,
          message: response.data.message || "Token 校验失败",
          check_mode: "remote"
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: "NETWORK_ERROR",
        message: e.message
      };
    }
  }
  
  if (command === 'send-sms') {
    const phoneArgIndex = args.indexOf('--phone');
    if (phoneArgIndex === -1 || phoneArgIndex + 1 >= args.length) {
      throw new Error('Missing --phone argument');
    }
    const phone = args[phoneArgIndex + 1];
    const phoneMasked = phone.substring(0, 3) + "****" + phone.substring(7);
    
    const auth = loadAuth();
    const tokenData = auth[AUTH_KEY] || {};
    let deviceToken = tokenData.device_token || "";
    if (!deviceToken) {
      deviceToken = generateDeviceToken(phone);
      tokenData.device_token = deviceToken;
      tokenData.phone_masked = phoneMasked;
      auth[AUTH_KEY] = tokenData;
      saveAuth(auth);
    }
    
    try {
      const response = await axios.post(
        'https://peppermall.meituan.com/eds/claw/login/sms/code/get',
        {
          mobile: phone,
          uuid: deviceToken
        },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "X-Requested-With": "XMLHttpRequest",
          },
          timeout: 10000
        }
      );
      
      const code = response.data.code;
      if (code === 0) {
        return {
          success: true,
          phone_masked: phoneMasked,
          message: `验证码已发送至手机号 ${phoneMasked}，请打开手机短信查看验证码，60秒内有效`
        };
      } else {
        let errorName = "SMS_SEND_FAILED";
        if (code === 20001) errorName = "SMS_MOBILE_TOKEN_ENCRYPT_FAIL";
        else if (code === 20002) errorName = "SMS_VERIFY_CODE_EXIST";
        else if (code === 20004) errorName = "CLAW_USER_NOT_REGISTERED";
        else if (code === 20006) errorName = "SMS_MOBILE_DAILY_LIMIT";
        else if (code === 20007) errorName = "SMS_DAILY_TOTAL_LIMIT";
        else if (code === 20010) errorName = "SMS_SECURITY_VERIFY_REQUIRED";
        
        return {
          success: false,
          error: errorName,
          code: code,
          message: response.data.message || "验证码发送失败",
          redirect_url: response.data.data?.redirectUrl || ""
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: "NETWORK_ERROR",
        message: e.message
      };
    }
  }
  
  if (command === 'verify') {
    const phoneArgIndex = args.indexOf('--phone');
    const codeArgIndex = args.indexOf('--code');
    if (phoneArgIndex === -1 || phoneArgIndex + 1 >= args.length || codeArgIndex === -1 || codeArgIndex + 1 >= args.length) {
      throw new Error('Missing --phone or --code argument');
    }
    const phone = args[phoneArgIndex + 1];
    const code = args[codeArgIndex + 1];
    const phoneMasked = phone.substring(0, 3) + "****" + phone.substring(7);
    
    const auth = loadAuth();
    const tokenData = auth[AUTH_KEY] || {};
    let deviceToken = tokenData.device_token || "";
    if (!deviceToken) {
      deviceToken = generateDeviceToken(phone);
      tokenData.device_token = deviceToken;
      auth[AUTH_KEY] = tokenData;
      saveAuth(auth);
    }
    
    try {
      const response = await axios.post(
        'https://peppermall.meituan.com/eds/claw/login/sms/code/verify',
        {
          mobile: phone,
          smsVerifyCode: code,
          uuid: deviceToken
        },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "X-Requested-With": "XMLHttpRequest",
          },
          timeout: 10000
        }
      );
      
      const respCode = response.data.code;
      if (respCode === 0) {
        const userToken = response.data.data?.token;
        if (!userToken) {
          return {
            success: false,
            error: "MISSING_TOKEN",
            message: "接口返回成功但 data.token 为空"
          };
        }
        
        tokenData.user_token = userToken;
        tokenData.device_token = deviceToken;
        tokenData.phone_masked = phoneMasked;
        tokenData.authed_at = Math.floor(Date.now() / 1000);
        auth[AUTH_KEY] = tokenData;
        saveAuth(auth);
        
        return {
          success: true,
          user_token: userToken,
          device_token: deviceToken,
          phone_masked: phoneMasked,
          message: "认证成功，user_token 已写入"
        };
      } else {
        let errorName = "VERIFY_FAILED";
        if (respCode === 20003) errorName = "SMS_VERIFY_CODE_ERROR";
        else if (respCode === 20004) errorName = "CLAW_USER_NOT_REGISTERED";
        
        return {
          success: false,
          error: errorName,
          code: respCode,
          message: response.data.message || "验证失败，请重试"
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: "NETWORK_ERROR",
        message: e.message
      };
    }
  }
  
  if (command === 'logout') {
    const auth = loadAuth();
    const tokenData = auth[AUTH_KEY] || {};
    tokenData.user_token = "";
    auth[AUTH_KEY] = tokenData;
    saveAuth(auth);
    return {
      success: true,
      message: "已退出登录，user_token 已清除，下次需重新验证登录",
      device_token_preserved: !!tokenData.device_token,
      phone_masked: tokenData.phone_masked || ""
    };
  }
  
  if (command === 'clear-device-token') {
    const auth = loadAuth();
    const tokenData = auth[AUTH_KEY] || {};
    const hadDeviceToken = !!tokenData.device_token;
    
    tokenData.user_token = "";
    tokenData.device_token = "";
    tokenData.phone_masked = "";
    auth[AUTH_KEY] = tokenData;
    saveAuth(auth);
    
    return {
      success: true,
      message: "设备标识已清除，下次登录将生成新的 device_token",
      device_token_cleared: hadDeviceToken
    };
  }
  
  throw new Error(`Unknown coupon auth command: ${command}`);
}

// ── Coupon Issue Implementations ──────────────────────────────────────
function loadConfig(configPath: string): any {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function fenToYuan(fen: any): string {
  if (!fen) return "0";
  const yuan = Number(fen) / 100;
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(1);
}

function formatTimestampMs(tsMs: any): string {
  if (!tsMs) return "-";
  try {
    const d = new Date(Number(tsMs));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  } catch (e) {
    return String(tsMs);
  }
}

function formatCoupon(c: any): any {
  const priceLimit = c.priceLimit;
  const couponValue = c.couponValue || 0;
  let discountInfo = "";
  if (priceLimit && priceLimit > 0) {
    discountInfo = `满${fenToYuan(priceLimit)}元减${fenToYuan(couponValue)}元`;
  }
  const start = c.couponStartTime;
  const end = c.couponEndTime;
  let validPeriod = "";
  if (start && end) {
    validPeriod = `${formatTimestampMs(start)} 至 ${formatTimestampMs(end)}`;
  }
  return {
    name: c.couponName || "",
    discount_info: discountInfo,
    valid_period: validPeriod
  };
}

async function handleCouponIssue(scriptPath: string, args: string[]): Promise<any> {
  const tokenArgIndex = args.indexOf('--token');
  if (tokenArgIndex === -1 || tokenArgIndex + 1 >= args.length) {
    throw new Error('Missing --token argument');
  }
  const token = args[tokenArgIndex + 1];
  
  const skillDir = path.dirname(path.dirname(scriptPath));
  const configPath = path.join(skillDir, 'config.json');
  const config = loadConfig(configPath);
  const aiScene = config.aiScene || "";
  
  try {
    const response = await axios.post(
      'https://media.meituan.com/fulishemini/couponActivity/aiSendCouponDistribution',
      {
        token: token,
        aiScene: aiScene
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "X-Requested-With": "XMLHttpRequest"
        },
        timeout: 15000
      }
    );
    
    const respData = response.data;
    const code = respData.code;
    const msg = respData.msg || "";
    const data = respData.data || {};
    
    if (code === 200) {
      const couponList = data.couponList || [];
      const formattedCoupons = couponList.map((c: any) => formatCoupon(c));
      return {
        success: true,
        code: 200,
        coupon_count: formattedCoupons.length,
        coupons: formattedCoupons,
        activity_name: data.activityName || "",
        activity_link: data.activityLink || ""
      };
    } else if (code === 1014) {
      return {
        success: false,
        code: 1014,
        error: "ALREADY_RECEIVED",
        message: "您今天已经领取过了，每天只能领取一次，明天再来哦～",
        activity_name: data.activityName || "",
        activity_link: data.activityLink || ""
      };
    } else if (code === 401) {
      return { success: false, code: 401, error: "RE_LOGIN", message: "登录已过期，请重新登录" };
    } else if (code === 509 || code === 50200) {
      return { success: false, code: code, error: "RATE_LIMIT", message: "请求过于频繁，请稍后重试" };
    } else if (code === 9999) {
      return { success: false, code: 9999, error: "SYSTEM_ERROR", message: "系统异常，请稍后重试" };
    } else {
      return { success: false, code: code, error: "UNKNOWN_ERROR", message: `未知错误（code=${code}，msg=${msg}）` };
    }
  } catch (e: any) {
    return {
      success: false,
      error: "NETWORK_ERROR",
      message: e.message
    };
  }
}

// ── Venue Bind Implementations ────────────────────────────────────────
async function handleVenueBind(command: string, args: string[]): Promise<any> {
  if (command === 'status') {
    const bindData = loadBind();
    const expireTime = bindData.expireTime || 0;
    
    if (!bindData || bindData.expireTime === undefined) {
      return { valid: false, reason: "no_bind" };
    }
    
    if (expireTime !== 0 && Math.floor(Date.now() / 1000) > expireTime) {
      return { valid: false, reason: "expired", expireTime: expireTime };
    }
    
    return { valid: true, expireTime: expireTime, reason: "" };
  }
  
  if (command === 'bind') {
    const tokenArgIndex = args.indexOf('--token');
    const codeWordArgIndex = args.indexOf('--code-word');
    if (tokenArgIndex === -1 || tokenArgIndex + 1 >= args.length || codeWordArgIndex === -1 || codeWordArgIndex + 1 >= args.length) {
      throw new Error('Missing --token or --code-word argument');
    }
    const token = args[tokenArgIndex + 1];
    const codeWord = args[codeWordArgIndex + 1];
    
    try {
      const response = await axios.post(
        'https://click.meituan.com/cps/skill/user/code/bind',
        {
          token: token,
          codeWord: codeWord
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000
        }
      );
      
      const respData = response.data;
      const code = respData.code;
      if (code === 0) {
        const expireTime = respData.expireTime || 0;
        const skillActLinkInfoList = respData.skillActLinkInfoList || [];
        
        const bindData = {
          codeWord: codeWord,
          expireTime: expireTime,
          skillActLinkInfoList: skillActLinkInfoList,
          boundAt: Math.floor(Date.now() / 1000)
        };
        saveBind(bindData);
        
        return {
          success: true,
          expireTime: expireTime,
          skillActLinkInfoList: skillActLinkInfoList,
          message: "口令绑定成功"
        };
      } else {
        return {
          success: false,
          code: code,
          message: respData.msg || "绑定失败"
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: "NETWORK_ERROR",
        message: e.message
      };
    }
  }
  
  if (command === 'get-links') {
    const bindData = loadBind();
    const links = bindData.skillActLinkInfoList || [];
    if (!links || links.length === 0) {
      return {
        success: false,
        error: "NO_LINKS",
        message: "本地暂无会场链接，请先完成口令绑定"
      };
    }
    return {
      success: true,
      links: links
    };
  }
  
  if (command === 'clear') {
    saveBind({});
    return {
      success: true,
      message: "本地口令绑定数据已清除"
    };
  }
  
  throw new Error(`Unknown venue bind command: ${command}`);
}

async function handleVenueAuth(command: string, args: string[]): Promise<any> {
  const AUTH_KEY = "meituan-venue-guide";
  
  if (command === 'logout') {
    const scriptPath = path.join(process.cwd(), 'node_modules', '@mtuser', 'pt-passport', 'dist', 'index.js');
    try {
      await execFileAsync('node', [scriptPath, 'logout', '--client_id', '578aafab312b44f1b76b0529b06bb0c6']);
    } catch (e) {}
    
    saveBind({});
    
    return {
      success: true,
      message: "已退出登录，下次需重新授权",
      device_token_preserved: true,
      cli_cache_cleared: true
    };
  }
  
  if (command === 'clear-device-token') {
    const scriptPath = path.join(process.cwd(), 'node_modules', '@mtuser', 'pt-passport', 'dist', 'index.js');
    try {
      await execFileAsync('node', [scriptPath, 'logout', '--client_id', '578aafab312b44f1b76b0529b06bb0c6']);
    } catch (e) {}
    
    const auth = loadAuth();
    auth[AUTH_KEY] = {};
    saveAuth(auth);
    
    saveBind({});
    
    return {
      success: true,
      message: "设备标识已清除，下次登录将生成新的 device_token",
      device_token_cleared: true
    };
  }
  
  throw new Error(`Unknown venue auth command: ${command}`);
}

// ── Exported API Interceptors ──────────────────────────────────────────
export async function runPythonScript(scriptPath: string, args: string[]): Promise<any> {
  console.log(`[skillsService] Intercepted Python command: python ${scriptPath} ${args.join(' ')}`);
  
  const scriptName = path.basename(scriptPath);
  if (scriptName === 'auth.py') {
    const command = args[0];
    return await handleCouponAuth(command, args);
  } else if (scriptName === 'issue.py') {
    return await handleCouponIssue(scriptPath, args);
  }
  throw new Error(`Unknown Python script execution: ${scriptPath}`);
}

export async function runVenuePythonScript(scriptPath: string, args: string[]): Promise<any> {
  console.log(`[skillsService] Intercepted Venue Python command: python ${scriptPath} ${args.join(' ')}`);
  
  const scriptName = path.basename(scriptPath);
  if (scriptName === 'bind.py') {
    const command = args[0];
    return await handleVenueBind(command, args);
  } else if (scriptName === 'auth.py') {
    const command = args[0];
    return await handleVenueAuth(command, args);
  }
  throw new Error(`Unknown Venue Python script execution: ${scriptPath}`);
}
