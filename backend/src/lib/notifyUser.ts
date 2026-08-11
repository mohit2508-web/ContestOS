import prisma from './prisma';
import { emitNotification } from './notificationEmitter';

export type NotificationType =
  | 'PROCTOR_ACTION'
  | 'CONTEST_UPDATE'
  | 'SYSTEM_ALERT'
  | 'WARNING'
  | 'INFO'
  | 'RESULT';

export interface NotifyPayload {
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: string;
}

/**
 * Creates a persisted notification in the DB and pushes it via SSE to the user.
 * Use this everywhere — proctor actions, contest updates, results, etc.
 */
export async function notifyUser(userId: string, payload: NotifyPayload): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        data: payload.referenceId ? { referenceId: payload.referenceId } : undefined,
        isRead: false,
      },
    });

    // Push via SSE stream to connected clients
    emitNotification({
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      notificationId: notification.id,
      referenceId: payload.referenceId,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch (err) {
    console.error('[notifyUser] Failed to create notification:', err);
  }
}

/**
 * Notify multiple users at once (e.g., all contest participants)
 */
export async function notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void> {
  await Promise.allSettled(userIds.map((uid) => notifyUser(uid, payload)));
}
