import { api } from '../client';

const desktopPrefsAPI = {
  getPreferences: () => api.get('/desktop-preferences/preferences'),
  savePreferences: data => api.put('/desktop-preferences/preferences', data),
  hideModule: moduleKey => api.patch('/desktop-preferences/preferences/hide', { module_key: moduleKey }),
  showModule: moduleKey => api.patch('/desktop-preferences/preferences/show', { module_key: moduleKey }),
  saveLayout: iconLayout => api.put('/desktop-preferences/preferences/layout', { icon_layout: iconLayout }),
};

export default desktopPrefsAPI;
