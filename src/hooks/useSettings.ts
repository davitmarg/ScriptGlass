import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiCall, isDesktop } from '@/src/lib/platform';

export const useSettings = () => {
  const [settings, setSettings] = useState({ 
    baseProjectsDir: '', 
    geminiKey: '',
    theme: (localStorage.getItem('sg_theme') || 'system') as 'light' | 'dark' | 'system'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);

  const fetchSettings = async () => {
    try {
      const data = await apiCall('/api/settings');
      setSettings(prev => {
        const next = { ...prev };
        if (data.baseProjectsDir !== undefined) next.baseProjectsDir = data.baseProjectsDir;
        if (data.geminiKey !== undefined) next.geminiKey = data.geminiKey;
        if (data.theme === 'light' || data.theme === 'dark') {
          next.theme = data.theme;
        }
        return next;
      });
      if (data.githubToken) {
        setGithubToken(data.githubToken);
        setIsGitHubConnected(true);
        if (!localStorage.getItem('sg_github_token')) {
          localStorage.setItem('sg_github_token', data.githubToken);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings');
    }
  };

  const handleUpdateSettings = async (fetchFilesCallback?: (path: string | null) => void, activePath?: string | null) => {
    try {
      await apiCall('/api/settings', {
        method: 'POST',
        body: settings,
      });
      toast.success('Settings updated');
      setIsSettingsOpen(false);
      if (fetchFilesCallback && activePath) {
        fetchFilesCallback(activePath);
      }
    } catch (error: any) {
      toast.error(`Failed to update settings: ${error.message}`);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      const data = await apiCall('/api/auth/github/url');
      if (data.error) throw new Error(data.error);

      if (data.isElectron && (window as any).electronAPI) {
        (window as any).electronAPI.startGitHubAuth(data.url);
      } else {
        window.open(data.url, 'github_oauth', 'width=600,height=700');
      }
    } catch (error) {
      toast.error('Failed to initiate GitHub connection');
    }
  };

  // Listen for GitHub token from OAuth callbacks
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const token = event.data.token;
        setGithubToken(token);
        setIsGitHubConnected(true);
        localStorage.setItem('sg_github_token', token);
        
        try {
          await apiCall('/api/settings', {
            method: 'POST',
            body: { githubToken: token },
          });
          toast.success('GitHub account connected and saved');
        } catch (error) {
          console.error('Failed to persist GitHub token');
          toast.success('GitHub account connected (local session only)');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle Electron specific token callback & external links
  useEffect(() => {
    if (isDesktop()) {
      const handleExternalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor && anchor.href && (anchor.href.startsWith('http') || anchor.href.startsWith('https'))) {
          e.preventDefault();
          apiCall('open-external-url', { body: { url: anchor.href } });
        }
      };
      document.addEventListener('click', handleExternalClick);
      
      const cleanupToken = (window as any).electronAPI?.onGitHubToken(async (token: string) => {
        setGithubToken(token);
        setIsGitHubConnected(true);
        localStorage.setItem('sg_github_token', token);
        
        try {
          await apiCall('/api/settings', {
            method: 'POST',
            body: { githubToken: token },
          });
          toast.success('GitHub account connected');
        } catch (error) {
          console.error('Failed to persist GitHub token to server');
          toast.success('GitHub account connected (local session)');
        }
      });

      return () => {
        document.removeEventListener('click', handleExternalClick);
        if (cleanupToken) cleanupToken();
      };
    }
  }, []);

  // Local storage token loader
  useEffect(() => {
    const savedToken = localStorage.getItem('sg_github_token');
    if (savedToken) {
      setGithubToken(savedToken);
      setIsGitHubConnected(true);
    }
  }, []);

  // Theme application
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      let effectiveTheme = settings.theme;
      
      if (settings.theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      localStorage.setItem('sg_theme', settings.theme);
    };

    applyTheme();
    
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.theme]);

  // Initial settings load
  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    setSettings,
    isSettingsOpen,
    setIsSettingsOpen,
    githubToken,
    setGithubToken,
    isGitHubConnected,
    setIsGitHubConnected,
    handleUpdateSettings,
    handleConnectGitHub
  };
};
