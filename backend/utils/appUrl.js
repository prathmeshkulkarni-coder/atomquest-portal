/** Public app URL for deep links (Render sets RENDER_EXTERNAL_URL automatically). */
export const getAppUrl = () => {
  let url =
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.CORS_ORIGIN ||
    'https://atomquest-portal-9u7c.onrender.com';
  url = url.replace(/\/$/, '');
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
};

export const deepLink = (path = '/') => `${getAppUrl()}${path.startsWith('/') ? path : `/${path}`}`;
