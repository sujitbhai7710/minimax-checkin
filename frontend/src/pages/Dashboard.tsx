// Dashboard page

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { accountsApi, adminApi } from '../utils/api';
import { MiniMaxAccount, StatusData } from '../types';
import {
  Zap,
  UserCircle,
  Coins,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [accounts, setAccounts] = useState<MiniMaxAccount[]>([]);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<number | null>(null);
  
  const fetchData = async () => {
    try {
      const [accountsRes, statusRes] = await Promise.all([
        accountsApi.getAll(),
        adminApi.getStatus()
      ]);
      
      if (accountsRes.data.success) {
        setAccounts(accountsRes.data.data.accounts);
      }
      
      if (statusRes.data.success) {
        setStatus(statusRes.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  const handleRefresh = async (accountId: number) => {
    setRefreshing(accountId);
    try {
      const response = await accountsApi.refresh(accountId);
      if (response.data.success) {
        toast.success('Credits refreshed');
        fetchData();
      } else {
        toast.error(response.data.error || 'Failed to refresh');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to refresh credits');
    } finally {
      setRefreshing(null);
    }
  };
  
  const handleCheckin = async (accountId: number) => {
    setRefreshing(accountId);
    try {
      const response = await accountsApi.checkin(accountId);
      if (response.data.success) {
        toast.success(response.data.message || 'Check-in successful');
        fetchData();
      } else {
        toast.error(response.data.error || 'Check-in failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Check-in failed');
    } finally {
      setRefreshing(null);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-dark-400">Overview of your MiniMax accounts</p>
        </div>
        <Link to="/accounts" className="btn-primary">
          <Plus className="w-5 h-5" />
          Add Account
        </Link>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary-600/20">
              <UserCircle className="w-5 h-5 text-primary-400" />
            </div>
            <span className="text-dark-400 text-sm">Total Accounts</span>
          </div>
          <span className="stat-value">{status?.stats.totalAccounts || accounts.length}</span>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-600/20">
              <Coins className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-dark-400 text-sm">Total Credits</span>
          </div>
          <span className="stat-value">{status?.stats.totalCredits?.toLocaleString() || 0}</span>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-600/20">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-dark-400 text-sm">Checked In Today</span>
          </div>
          <span className="stat-value">{status?.stats.activeToday || 0}</span>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-600/20">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-dark-400 text-sm">Pending</span>
          </div>
          <span className="stat-value">{status?.stats.pendingToday || 0}</span>
        </div>
      </div>
      
      {/* Cron Status */}
      {status?.cronState && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                status.cronState.status === 'completed' ? 'bg-green-600/20' :
                status.cronState.status === 'running' ? 'bg-blue-600/20' : 'bg-yellow-600/20'
              }`}>
                <Zap className={`w-5 h-5 ${
                  status.cronState.status === 'completed' ? 'text-green-400' :
                  status.cronState.status === 'running' ? 'text-blue-400' : 'text-yellow-400'
                }`} />
              </div>
              <div>
                <h3 className="font-medium">Auto Check-in Status</h3>
                <p className="text-sm text-dark-400">
                  {status.cronState.status === 'completed' 
                    ? 'All accounts processed for today'
                    : status.cronState.status === 'running'
                    ? 'Currently processing...'
                    : 'Waiting for next run'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-dark-400">Progress</p>
              <p className="font-medium">
                {status.cronState.current_account_index} / {status.cronState.total_accounts} accounts
              </p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-500"
                style={{
                  width: `${(status.cronState.current_account_index / Math.max(status.cronState.total_accounts, 1)) * 100}%`
                }}
              />
            </div>
          </div>
          
          {status.nextCheckIn && (
            <p className="mt-2 text-sm text-dark-400">
              Next check-in: {format(new Date(status.nextCheckIn), 'PPpp')}
            </p>
          )}
        </div>
      )}
      
      {/* Accounts List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Accounts</h2>
          <button
            onClick={fetchData}
            className="btn-ghost btn-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        
        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <UserCircle className="w-12 h-12 text-dark-500 mx-auto mb-4" />
            <p className="text-dark-400 mb-4">No accounts added yet</p>
            <Link to="/accounts" className="btn-primary">
              <Plus className="w-5 h-5" />
              Add Your First Account
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-dark-800 border border-dark-700"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    account.checkin_status === 'success' ? 'bg-green-600/20' :
                    account.checkin_status === 'failed' ? 'bg-red-600/20' : 'bg-yellow-600/20'
                  }`}>
                    {account.checkin_status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : account.checkin_status === 'failed' ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">{account.account_name}</h3>
                    <p className="text-sm text-dark-400">
                      {account.last_checkin 
                        ? `Last check-in: ${format(new Date(account.last_checkin), 'PPpp')}`
                        : 'Never checked in'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-lg">{account.current_credits.toLocaleString()}</p>
                    <p className="text-sm text-dark-400">credits</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRefresh(account.id)}
                      disabled={refreshing === account.id}
                      className="btn-ghost btn-sm"
                      title="Refresh credits"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshing === account.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleCheckin(account.id)}
                      disabled={refreshing === account.id}
                      className="btn-primary btn-sm"
                    >
                      Check In
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
