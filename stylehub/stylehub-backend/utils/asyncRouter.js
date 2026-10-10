import { Router as ExpressRouter } from 'express';

// Forward rejected asynchronous handlers to Express 4 error middleware.
export function Router() {
  const router = ExpressRouter();
  const wrap = handler => Array.isArray(handler) ? handler.map(wrap) :
    typeof handler !== 'function' || handler.length === 4 ? handler :
      function (req, res, next) {
        try { Promise.resolve(handler(req, res, next)).catch(next); }
        catch (error) { next(error); }
      };
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use']) {
    const original = router[method].bind(router);
    router[method] = (...args) => original(...args.map(wrap));
  }
  return router;
}
