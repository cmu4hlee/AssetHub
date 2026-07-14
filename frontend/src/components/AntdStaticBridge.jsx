import { App as AntdApp, message as staticMessage, notification as staticNotification, Modal } from 'antd';

const bridgeState = {
  initialized: false,
  messageApi: null,
  notificationApi: null,
  modalApi: null,
  queue: {
    message: [],
    notification: [],
    modal: [],
  },
};

const enqueueOrCall = (type, method, args) => {
  const api = bridgeState[`${type}Api`];
  if (api && typeof api[method] === 'function') {
    return api[method](...args);
  }
  bridgeState.queue[type].push({ method, args });
  return undefined;
};

const patchStaticMethods = (target, type, methods) => {
  methods.forEach(method => {
    target[method] = (...args) => enqueueOrCall(type, method, args);
  });
};

const flushQueue = type => {
  const api = bridgeState[`${type}Api`];
  if (!api) return;

  const pending = bridgeState.queue[type].splice(0, bridgeState.queue[type].length);
  pending.forEach(({ method, args }) => {
    if (typeof api[method] === 'function') {
      api[method](...args);
    }
  });
};

const bindAppApis = ({ message, notification, modal }) => {
  bridgeState.messageApi = message || bridgeState.messageApi;
  bridgeState.notificationApi = notification || bridgeState.notificationApi;
  bridgeState.modalApi = modal || bridgeState.modalApi;

  flushQueue('message');
  flushQueue('notification');
  flushQueue('modal');
};

const initBridge = () => {
  if (bridgeState.initialized) return;
  bridgeState.initialized = true;

  patchStaticMethods(staticMessage, 'message', [
    'open',
    'success',
    'error',
    'warning',
    'info',
    'loading',
    'destroy',
  ]);

  patchStaticMethods(staticNotification, 'notification', [
    'open',
    'success',
    'error',
    'warning',
    'info',
    'destroy',
  ]);

  patchStaticMethods(Modal, 'modal', ['info', 'success', 'error', 'warning', 'confirm', 'destroyAll']);
};

initBridge();

export default function AntdStaticBridge() {
  const { message, notification, modal } = AntdApp.useApp();
  bindAppApis({ message, notification, modal });
  return null;
}
