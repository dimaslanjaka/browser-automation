// Vite plugin to redirect /browser-automation to /browser-automation/
export default function RedirectBrowserAutomationPlugin() {
  return {
    name: 'redirect-browser-automation',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/browser-automation') {
          res.writeHead(301, { Location: '/browser-automation/' });
          res.end();
          return;
        }
        next();
      });
    }
  };
}
