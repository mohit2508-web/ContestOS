import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface SubscriptionInfo {
  plan: string;
  status: string;
  features: string[];
  isPremium: boolean;
}

export function useSubscription() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMySubscription()
      .then(setSub)
      .catch(() => setSub({ plan: 'free', status: 'active', features: [], isPremium: false }))
      .finally(() => setLoading(false));
  }, []);

  const hasFeature = (feature: string): boolean => {
    if (!sub) return false;
    if (sub.plan === 'enterprise') return true;
    if (sub.plan === 'pro' && feature !== 'team_management' && feature !== 'sso' && feature !== 'audit_logs' && feature !== 'dedicated_support' && feature !== 'custom_domain') return true;
    return sub.features.includes(feature);
  };

  const refresh = async () => {
    const updated = await api.getMySubscription();
    setSub(updated);
  };

  return { ...sub, loading, hasFeature, refresh };
}
