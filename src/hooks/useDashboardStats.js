import { useState, useEffect, useCallback, useRef } from 'react';
import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';
import { getUserDashboardStats, EMPTY_DASHBOARD_STATS } from '../services/dashboardService.js';

export function useDashboardStats() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const mountedRef = useRef(true);

  const fetchStats = useCallback(async (client) => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getUserDashboardStats(client);
      if (mountedRef.current) {
        setStats(data);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch dashboard statistics.');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let authUnsubscribe = null;

    async function initAuth() {
      try {
        const client = getBrowserSupabaseClient();
        if (!client) {
          if (mountedRef.current) setAuthLoading(false);
          return;
        }

        const { data: { session: currentSession } } = await client.auth.getSession();
        if (mountedRef.current) {
          setSession(currentSession);
          setAuthLoading(false);
        }

        if (currentSession?.user) {
          fetchStats(client);
        }

        const { data: { subscription } } = client.auth.onAuthStateChange((_event, newSession) => {
          if (!mountedRef.current) return;
          setSession(newSession);
          if (newSession?.user) {
            fetchStats(client);
          } else {
            setStats(null);
            setLoading(false);
            setError(null);
          }
        });

        authUnsubscribe = () => subscription.unsubscribe();
      } catch (err) {
        if (mountedRef.current) {
          setAuthLoading(false);
          setError(err.message);
        }
      }
    }

    initAuth();

    return () => {
      mountedRef.current = false;
      if (authUnsubscribe) authUnsubscribe();
    };
  }, [fetchStats]);

  // Listen for 'aptis:attempt-submitted' and 'aptis:evaluation-updated' custom events to trigger auto-refetch
  useEffect(() => {
    const handleRefetch = () => {
      const client = getBrowserSupabaseClient();
      if (session?.user && client) {
        fetchStats(client);
      }
    };

    window.addEventListener('aptis:attempt-submitted', handleRefetch);
    window.addEventListener('aptis:evaluation-updated', handleRefetch);
    return () => {
      window.removeEventListener('aptis:attempt-submitted', handleRefetch);
      window.removeEventListener('aptis:evaluation-updated', handleRefetch);
    };
  }, [session, fetchStats]);


  const retry = useCallback(() => {
    const client = getBrowserSupabaseClient();
    if (session?.user && client) {
      fetchStats(client);
    }
  }, [session, fetchStats]);

  return {
    authLoading,
    unauthenticated: !authLoading && !session?.user,
    loading: authLoading || loading,
    success: !!stats && !loading && !error,
    error,
    stats: session?.user ? (stats || EMPTY_DASHBOARD_STATS) : null,
    retry
  };
}
