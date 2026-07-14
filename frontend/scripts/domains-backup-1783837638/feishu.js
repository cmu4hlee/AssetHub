import {
  isFeishuWebApp,
  invokeFeishuApi,
  postMessageToFeishuHost,
  closeFeishuWebApp,
} from '../../utils/feishu';

/**
 * 飞书网页应用桥接 API
 *
 * 飞书网页应用通过 window.h5sdk 注入的 JSAPI 进行调用,
 * 当页面未运行在飞书宿主中时,所有方法均安全降级为本地实现。
 */
export const feishuAPI = {
  /**
   * 检测是否运行在飞书网页应用环境中
   */
  isFeishuWebApp,

  /**
   * 通用 JSAPI 调用,失败时返回 reject
   */
  invoke: (api, params, options) => invokeFeishuApi(api, params, options),

  /**
   * 关闭当前飞书网页应用
   */
  close: () => closeFeishuWebApp(),

  /**
   * 向飞书宿主投递自定义 postMessage 消息
   */
  postMessage: (type, payload) => postMessageToFeishuHost(type, payload),

  /**
   * 设置飞书网页应用右上角菜单(部分版本支持)
   */
  setMenu: items =>
    invokeFeishuApi('setMenu', { items }, { timeout: 3000 }).catch(() => false),

  /**
   * 设置飞书网页应用导航栏标题(部分版本支持)
   */
  setTitle: title =>
    invokeFeishuApi('setTitle', { title }, { timeout: 3000 }).catch(() => false),

  /**
   * 获取当前用户信息(飞书免登录场景)
   */
  getUserInfo: () => invokeFeishuApi('getUserInfo', {}, { timeout: 4000 }),

  /**
   * 申请飞书鉴权码(用于后端交换 user_access_token)
   */
  requestAuthCode: () => invokeFeihauRequestAuthCodeSafe(),

  /**
   * 主动通知宿主页面尺寸变化,辅助宿主重新布局
   */
  notifyResize: () => {
    if (typeof window === 'undefined') return false;
    return postMessageToFeishuHost('resize', {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  },
};

const invokeFeihauRequestAuthCodeSafe = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  return invokeFeishuApi('requestAuthCode', {}, { timeout: 5000 }).catch(err => {
    if (typeof window.AuthCodeManager?.requestAuthCode === 'function') {
      return window.AuthCodeManager.requestAuthCode({});
    }
    throw err;
  });
};

export default feishuAPI;