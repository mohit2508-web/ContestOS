import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { EventEmitter } from 'events';

const router = Router();

// Global EventEmitter for Real-Time SSE Notification Push
export const notificationEmitter = new EventEmitter();

// GET /api/notifications - Get all notifications for current user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread badge count
router.get('/unread-count', authenticateToken, async (req: Request, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, isRead: false },
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { isRead: true },
    });
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// GET /api/notifications/stream - SSE Live Stream for Real-Time Notification Push
router.get('/stream', authenticateToken, (req: Request, res: Response) => {
  const userId = req.user!.userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onNotification = (data: { targetUserId: string; notification: any }) => {
    if (data.targetUserId === userId) {
      res.write(`data: ${JSON.stringify(data.notification)}\n\n`);
    }
  };

  notificationEmitter.on('push', onNotification);

  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    notificationEmitter.removeListener('push', onNotification);
    res.end();
  });
});

export default router;
