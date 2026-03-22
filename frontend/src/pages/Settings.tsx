// Settings page

import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { adminApi } from '../utils/api';
import {
  User,
  Shield,
  Database,
  Zap,
  Play,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuthStore();
  const [triggeringCron, setTriggeringCron] = useState(false);
  
  const handleTriggerCron = async () => {
    if (!confirm('Manually trigger a check-in for the next account in queue?')) {
      return;
    }
    
    setTriggeringCron(true);
    try {
      const response = await adminApi.triggerCron();
      if (response.data.success) {
        toast.success('Cron job triggered');
      } else {
        toast.error(response.data.error || 'Failed to trigger cron');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to trigger cron');
    } finally {
      setTriggeringCron(false);
    }
  };
  
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-dark-400">Manage your account and system settings</p>
      </div>
      
      {/* Profile Section */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-primary-400" />
          <h3 className="font-medium">Profile</h3>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={user?.name || ''}
                disabled
                className="input bg-dark-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="input bg-dark-800"
              />
            </div>
          </div>
          
          <p className="text-sm text-dark-500">
            Profile information is currently read-only. Contact support to update your details.
          </p>
        </div>
      </div>
      
      {/* System Section */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-5 h-5 text-primary-400" />
          <h3 className="font-medium">Auto Check-in System</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-dark-800 border border-dark-700">
            <div>
              <h4 className="font-medium">Cron Schedule</h4>
              <p className="text-sm text-dark-400">
                Runs every 30 minutes starting from 5:30 AM IST
              </p>
            </div>
            <span className="badge badge-success">Active</span>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-dark-800 border border-dark-700">
            <div>
              <h4 className="font-medium">Manual Trigger</h4>
              <p className="text-sm text-dark-400">
                Manually run the next check-in in the queue
              </p>
            </div>
            <button
              onClick={handleTriggerCron}
              disabled={triggeringCron}
              className="btn-primary btn-sm"
            >
              {triggeringCron ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Trigger
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Information Section */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-primary-400" />
          <h3 className="font-medium">System Information</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-dark-700">
            <span className="text-dark-400">Version</span>
            <span className="font-mono">1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-dark-700">
            <span className="text-dark-400">Backend</span>
            <span>Cloudflare Workers</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-dark-700">
            <span className="text-dark-400">Database</span>
            <span>Cloudflare D1</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-dark-700">
            <span className="text-dark-400">Frontend</span>
            <span>React + Vite</span>
          </div>
        </div>
      </div>
      
      {/* Links Section */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-primary-400" />
          <h3 className="font-medium">Useful Links</h3>
        </div>
        
        <div className="space-y-3">
          <a
            href="https://agent.minimax.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-dark-800 border border-dark-700 hover:border-primary-600/50 transition-colors"
          >
            <span>MiniMax Agent</span>
            <ExternalLink className="w-4 h-4 text-dark-400" />
          </a>
          
          <a
            href="https://agent.minimax.io/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-dark-800 border border-dark-700 hover:border-primary-600/50 transition-colors"
          >
            <span>MiniMax Pricing</span>
            <ExternalLink className="w-4 h-4 text-dark-400" />
          </a>
        </div>
      </div>
      
      {/* Danger Zone */}
      <div className="card border-red-600/20">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-red-400" />
          <h3 className="font-medium text-red-400">Danger Zone</h3>
        </div>
        
        <p className="text-dark-400 text-sm mb-4">
          Deleting your account will remove all your data including all MiniMax accounts and check-in history.
          This action cannot be undone.
        </p>
        
        <button
          disabled
          className="btn-danger opacity-50 cursor-not-allowed"
        >
          Delete Account (Disabled)
        </button>
      </div>
    </div>
  );
}
