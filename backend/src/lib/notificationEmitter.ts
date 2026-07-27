import { EventEmitter } from 'events';

interface NotificationEvent {
  userId: string;
  type: string;
  title: string;
  message: string;
  notificationId: string;
  referenceId?: string;
  createdAt: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

export const NOTIFICATION_EVENT = 'notification';

export function emitNotification(event: NotificationEvent): void {
  emitter.emit(NOTIFICATION_EVENT, event);
}

export function onNotification(userId: string, callback: (event: NotificationEvent) => void): () => void {
  const handler = (event: NotificationEvent) => {
    if (event.userId === userId) {
      callback(event);
    }
  };
  emitter.on(NOTIFICATION_EVENT, handler);
  return () => { emitter.off(NOTIFICATION_EVENT, handler); };
}

export type { NotificationEvent };
