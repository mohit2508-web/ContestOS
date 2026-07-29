import { useEffect, useState, useCallback } from 'react';
import { StreamVideoClient, Call } from '@stream-io/video-react-sdk';
import { StreamChat, Channel } from 'stream-chat';
import { api } from '../services/api';
import { useNotify } from '../components/notifications';

const apiKey = import.meta.env.VITE_STREAM_API_KEY;

let cachedVideoClient: StreamVideoClient | null = null;
let cachedUserId: string | null = null;

async function getOrCreateVideoClient(user: { id: string; name: string }, token: string) {
  if (cachedVideoClient && cachedUserId === user.id) {
    return cachedVideoClient;
  }
  if (cachedVideoClient) {
    try { await cachedVideoClient.disconnectUser(); } catch (err) { console.error('Operation failed:', err); }
    cachedVideoClient = null;
  }
  const client = new StreamVideoClient({ apiKey, user, token });
  cachedVideoClient = client;
  cachedUserId = user.id;
  return client;
}

export function useStreamClient(sessionId: string | undefined, userId: string, userName: string) {
  const notify = useNotify();
  const [streamVideoClient, setStreamVideoClient] = useState<StreamVideoClient | null>(null);
  const [streamChatClient, setStreamChatClient] = useState<StreamChat | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setRetryCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!sessionId || !userId || !apiKey) {
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    setError(null);
    let isSubscribed = true;
    let chatClientInstance: StreamChat | null = null;
    let joinedCall: Call | null = null;

    async function initializeStream() {
      try {
        const { token, userName: streamUserName, userImage } = await api.getStreamToken();

        const user = { id: userId, name: streamUserName || userName, ...(userImage && { image: userImage }) };

        const videoClient = await getOrCreateVideoClient(user, token);
        if (!isSubscribed) return;
        setStreamVideoClient(videoClient);

        chatClientInstance = StreamChat.getInstance(apiKey);
        if (chatClientInstance.userID !== user.id) {
          if (chatClientInstance.userID) {
            await chatClientInstance.disconnectUser();
          }
          await chatClientInstance.connectUser(user, token);
        }
        if (!isSubscribed) return;
        setStreamChatClient(chatClientInstance);

        joinedCall = videoClient.call('default', sessionId!);
        await joinedCall.join();
        if (!isSubscribed) return;
        setCall(joinedCall);

        const currentChannel = chatClientInstance.channel('messaging', sessionId!);
        await currentChannel.watch();
        if (!isSubscribed) return;
        setChannel(currentChannel);

      } catch (err) {
        console.error('Failed to initialize Stream clients:', err);
        if (isSubscribed) {
          const message = err instanceof Error ? err.message : 'Failed to connect video call';
          setError(message);
          notify.toast.error('Failed to connect video call — using local camera', {
            description: 'Connection failed. Switching to local fallback.',
          });
        }
      } finally {
        if (isSubscribed) setIsInitializing(false);
      }
    }

    initializeStream();

    return () => {
      isSubscribed = false;
      if (joinedCall) {
        joinedCall.leave().catch(() => {});
      }
      if (chatClientInstance) {
        chatClientInstance.disconnectUser().catch(() => {});
      }
    };
  }, [sessionId, userId, userName, retryCount, notify]);

  return { streamVideoClient, streamChatClient, call, channel, isInitializing, error, retry };
}
