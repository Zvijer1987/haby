import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import habitsRoutes from './routes/habits.js';
import settingsRoutes from './routes/settings.js';
import widgetRoutes from './routes/widgets.js';
import { initDatabase } from './db/init.js';

await initDatabase();

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// Simple same-origin style guard for write requests.
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.get('origin');
    const host = req.get('host');
    if (origin && host && !origin.includes(host.split(':')[0])) {
      return res.status(403).json({ error: 'Cross-site write blocked' });
    }
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/widgets', widgetRoutes);

const clientDir = '/app/client/dist';
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Haby server listening on ${port}`);
});
