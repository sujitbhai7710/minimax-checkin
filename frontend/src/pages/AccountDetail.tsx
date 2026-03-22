// Account Detail page - View history and manage single account

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { accountsApi } from '../utils/api';
import { AccountDetailData } from '../types';
import {
  ArrowLeft,
  Coins,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Play,
  Edit,
  Trash2,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<AccountDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'refresh' | 'checkin' | null>(null);
  
  useEffect(() => {
    if (id) {
      fetchAccountDetail();
    }
  }, [id]);
  
  const fetchAccountDetail = async () => {
    try {
      const response = await accountsApi.getOne(parseInt(id!));
      if (response.data.success) {
        setData(response.data.data);
      } else {
        toast.error('Account not found');
        navigate('/accounts');
      }
    } catch (error) {
      toast.error('Failed to fetch account details');
      navigate('/accounts');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setActionLoading('refresh');
    try {
      const response = await accountsApi.refresh(parseInt(id!));
      if (response.data.success) {
        toast.success('Credits refreshed');
        fetchAccountDetail();
      } else {
        toast.error(response.data.error || 'Failed to refresh');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to refresh credits');
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleCheckin = async () => {
    setActionLoading('checkin');
    try {
      const response = await accountsApi.checkin(parseInt(id!));
      if (response.data.success) {
        toast.success(response.data.message || 'Check-in successful');
        fetchAccountDetail();
      } else {
        toast.error(response.data.error || 'Check-in failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Check-in failed');
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this account?')) {
      return;
    }
    
    try {
      const response = await accountsApi.delete(parseInt(id!));
      if (response.data.success) {
        toast.success('Account deleted');
        navigate('/accounts');
      } else {
        toast.error(response.data.error || 'Failed to delete account');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete account');
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-400">Account not found</p>
        <button onClick={() => navigate('/accounts')} className="btn-primary mt-4">
          Go Back
        </button>
      </div>
    );
  }
  
  const { account, history } = data;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={() => navigate('/accounts')}
          className="btn-ghost w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{account.account_name}</h1>
          <p className="text-dark-400">
            Account ID: {account.id} • Added {format(new Date(account.created_at), 'PP')}
          </p>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-600/20">
              <Coins className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-dark-400 text-sm">Current Credits</span>
          </div>
          <span className="stat-value">{account.current_credits.toLocaleString()}</span>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-600/20">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-dark-400 text-sm">Last Check-in</span>
          </div>
          <span className="stat-value text-xl">
            {account.last_checkin
              ? formatDistanceToNow(new Date(account.last_checkin), { addSuffix: true })
              : 'Never'}
          </span>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
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
            <span className="text-dark-400 text-sm">Status</span>
          </div>
          <span className={`stat-value text-xl ${
            account.checkin_status === 'success' ? 'text-green-400' :
            account.checkin_status === 'failed' ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {account.checkin_status.charAt(0).toUpperCase() + account.checkin_status.slice(1)}
          </span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="card">
        <h3 className="font-medium mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCheckin}
            disabled={actionLoading !== null}
            className="btn-primary"
          >
            {actionLoading === 'checkin' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Check In Now
              </>
            )}
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={actionLoading !== null}
            className="btn-secondary"
          >
            {actionLoading === 'refresh' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Refresh Credits
              </>
            )}
          </button>
          
          <button
            onClick={() => navigate('/accounts')}
            className="btn-ghost"
          >
            <Edit className="w-5 h-5" />
            Edit Account
          </button>
          
          <button
            onClick={handleDelete}
            className="btn-danger"
          >
            <Trash2 className="w-5 h-5" />
            Delete
          </button>
        </div>
      </div>
      
      {/* History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Check-in History</h3>
          <span className="text-sm text-dark-400">Last 30 days</span>
        </div>
        
        {history.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-dark-500 mx-auto mb-4" />
            <p className="text-dark-400">No check-in history yet</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Credits Before</th>
                  <th>Credits After</th>
                  <th>Earned</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div>
                        <p className="font-medium">
                          {format(new Date(item.checkin_time), 'PP')}
                        </p>
                        <p className="text-dark-400 text-xs">
                          {format(new Date(item.checkin_time), 'p')}
                        </p>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        item.status === 'success' ? 'badge-success' :
                        item.status === 'failed' ? 'badge-error' : 'badge-info'
                      }`}>
                        {item.status === 'already_checked_in' ? 'Already Done' : item.status}
                      </span>
                    </td>
                    <td>{item.credits_before?.toLocaleString() || '-'}</td>
                    <td>{item.credits_after?.toLocaleString() || '-'}</td>
                    <td>
                      {item.credits_earned && item.credits_earned > 0 ? (
                        <span className="text-green-400">+{item.credits_earned.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {item.error_message && (
                        <span className="text-red-400 text-sm truncate max-w-xs block">
                          {item.error_message}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
