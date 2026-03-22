// History page - View all check-in history and logs

import { useState, useEffect } from 'react';
import { adminApi } from '../utils/api';
import { SystemLog, DailySummary } from '../types';
import {
  Calendar,
  Info,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import toast from 'react-hot-toast';

export default function History() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  useEffect(() => {
    fetchData();
  }, [selectedDate]);
  
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [logsRes, summaryRes] = await Promise.all([
        adminApi.getLogs(100),
        adminApi.getSummary(dateStr)
      ]);
      
      if (logsRes.data.success) {
        setLogs(logsRes.data.data.logs);
      }
      
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  };
  
  const goToPrevDay = () => {
    setSelectedDate(subDays(selectedDate, 1));
  };
  
  const goToNextDay = () => {
    const tomorrow = addDays(selectedDate, 1);
    if (tomorrow <= new Date()) {
      setSelectedDate(tomorrow);
    }
  };
  
  const goToToday = () => {
    setSelectedDate(new Date());
  };
  
  const getLogIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Info className="w-5 h-5 text-dark-400" />;
    }
  };
  
  const getLogBadgeClass = (type: string) => {
    switch (type) {
      case 'info':
        return 'badge-info';
      case 'warning':
        return 'badge-warning';
      case 'error':
        return 'badge-error';
      default:
        return 'badge-neutral';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">History & Logs</h1>
          <p className="text-dark-400">View check-in history and system logs</p>
        </div>
        <button onClick={fetchData} className="btn-secondary">
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>
      
      {/* Date Selector */}
      <div className="card">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevDay}
            className="btn-ghost btn-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-400" />
              <span className="font-medium">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            {format(selectedDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd') && (
              <button onClick={goToToday} className="btn-ghost btn-sm">
                Today
              </button>
            )}
          </div>
          
          <button
            onClick={goToNextDay}
            disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}
            className="btn-ghost btn-sm disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Daily Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="stat-card">
            <span className="text-dark-400 text-sm">Total Accounts</span>
            <span className="stat-value">{summary.stats.total_accounts || 0}</span>
          </div>
          <div className="stat-card">
            <span className="text-dark-400 text-sm">Successful</span>
            <span className="stat-value text-green-400">{summary.stats.successful || 0}</span>
          </div>
          <div className="stat-card">
            <span className="text-dark-400 text-sm">Already Checked</span>
            <span className="stat-value text-blue-400">{summary.stats.already_checked || 0}</span>
          </div>
          <div className="stat-card">
            <span className="text-dark-400 text-sm">Failed</span>
            <span className="stat-value text-red-400">{summary.stats.failed || 0}</span>
          </div>
          <div className="stat-card">
            <span className="text-dark-400 text-sm">Credits Earned</span>
            <span className="stat-value text-green-400">
              +{(summary.stats.total_credits_earned || 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
      
      {/* Logs */}
      <div className="card">
        <h3 className="font-medium mb-4">System Logs</h3>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-dark-500 mx-auto mb-4" />
            <p className="text-dark-400">No logs yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-dark-800 border border-dark-700"
              >
                <div className={`p-2 rounded-lg ${
                  log.log_type === 'info' ? 'bg-blue-600/20' :
                  log.log_type === 'warning' ? 'bg-yellow-600/20' : 'bg-red-600/20'
                }`}>
                  {getLogIcon(log.log_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge ${getLogBadgeClass(log.log_type)}`}>
                      {log.log_type}
                    </span>
                    <span className="text-dark-400 text-sm">
                      {format(new Date(log.created_at), 'PPpp')}
                    </span>
                  </div>
                  <p className="text-dark-100">{log.message}</p>
                  {log.details && (
                    <p className="text-dark-400 text-sm mt-1 font-mono truncate">
                      {log.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
