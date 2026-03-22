// Accounts page - Add/Edit/Delete accounts with Test functionality

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsApi, testCookiesApi } from '../utils/api';
import { MiniMaxAccount } from '../types';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  X,
  CheckCircle,
  AlertCircle,
  Cookie,
  Zap,
  User,
  Coins,
  RefreshCw,
  TestTube
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TestResult {
  user?: {
    id: string;
    name: string;
    avatar: string;
  };
  credits?: {
    total: number;
    used: number;
    remaining: number;
  };
  checkin?: {
    canCheckin: boolean;
    alreadyCheckedIn: boolean;
    message: string;
  };
}

export default function Accounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<MiniMaxAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingAccount, setEditingAccount] = useState<MiniMaxAccount | null>(null);
  const [formData, setFormData] = useState({ account_name: '', cookies: '' });
  const [showCookies, setShowCookies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTestingCookies, setIsTestingCookies] = useState(false);
  
  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);
  
  const fetchAccounts = async () => {
    try {
      const response = await accountsApi.getAll();
      if (response.data.success) {
        setAccounts(response.data.data.accounts);
      }
    } catch (error) {
      toast.error('Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  };
  
  const openAddModal = () => {
    setModalMode('add');
    setFormData({ account_name: '', cookies: '' });
    setTestResult(null);
    setShowModal(true);
  };
  
  const openEditModal = (account: MiniMaxAccount) => {
    setModalMode('edit');
    setEditingAccount(account);
    setFormData({ 
      account_name: account.account_name, 
      cookies: '' // Don't show existing cookies
    });
    setTestResult(null);
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setEditingAccount(null);
    setFormData({ account_name: '', cookies: '' });
    setShowCookies(false);
    setTestResult(null);
  };
  
  const handleTestCookies = async () => {
    if (!formData.cookies) {
      toast.error('Please enter cookies to test');
      return;
    }
    
    setIsTestingCookies(true);
    setTestResult(null);
    
    try {
      const response = await testCookiesApi(formData.cookies);
      if (response.data.success) {
        setTestResult(response.data.data);
        toast.success('Cookies are valid!');
        
        // Auto-fill account name from user name if adding new account
        if (modalMode === 'add' && response.data.data.user?.name && !formData.account_name) {
          setFormData(prev => ({ ...prev, account_name: response.data.data.user.name }));
        }
      } else {
        toast.error(response.data.error || 'Invalid cookies');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to test cookies');
    } finally {
      setIsTestingCookies(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.account_name) {
      toast.error('Account name is required');
      return;
    }
    
    if (modalMode === 'add' && !formData.cookies) {
      toast.error('Cookies are required for new accounts');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (modalMode === 'add') {
        const response = await accountsApi.create(formData.account_name, formData.cookies);
        if (response.data.success) {
          toast.success('Account added successfully');
          fetchAccounts();
          closeModal();
        } else {
          toast.error(response.data.error || 'Failed to add account');
        }
      } else if (editingAccount) {
        const updateData: { account_name?: string; cookies?: string } = {
          account_name: formData.account_name
        };
        if (formData.cookies) {
          updateData.cookies = formData.cookies;
        }
        
        const response = await accountsApi.update(editingAccount.id, updateData);
        if (response.data.success) {
          toast.success('Account updated successfully');
          fetchAccounts();
          closeModal();
        } else {
          toast.error(response.data.error || 'Failed to update account');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (account: MiniMaxAccount) => {
    if (!confirm(`Are you sure you want to delete "${account.account_name}"?`)) {
      return;
    }
    
    setDeletingId(account.id);
    
    try {
      const response = await accountsApi.delete(account.id);
      if (response.data.success) {
        toast.success('Account deleted');
        fetchAccounts();
      } else {
        toast.error(response.data.error || 'Failed to delete account');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete account');
    } finally {
      setDeletingId(null);
    }
  };
  
  const handleTestAccount = async (account: MiniMaxAccount) => {
    setTestingId(account.id);
    
    try {
      const response = await accountsApi.test(account.id);
      if (response.data.success) {
        const data = response.data.data;
        toast.success(
          `${data.user?.name || 'Account'}: ${data.credits?.remaining || 0} credits, ${data.checkin?.alreadyCheckedIn ? 'Already checked in' : 'Can check in'}`,
          { duration: 5000 }
        );
      } else {
        toast.error(response.data.error || 'Test failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to test account');
    } finally {
      setTestingId(null);
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
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-dark-400">Manage your MiniMax accounts</p>
        </div>
        <button onClick={openAddModal} className="btn-primary">
          <Plus className="w-5 h-5" />
          Add Account
        </button>
      </div>
      
      {/* Instructions */}
      <div className="card bg-primary-600/10 border-primary-600/20">
        <h3 className="font-medium text-primary-400 mb-2">How to get cookies?</h3>
        <ol className="list-decimal list-inside space-y-1 text-dark-300 text-sm">
          <li>Login to <a href="https://agent.minimax.io" target="_blank" rel="noopener" className="text-primary-400 hover:underline">agent.minimax.io</a></li>
          <li>Open Developer Tools (F12)</li>
          <li>Go to Application → Cookies OR Network tab</li>
          <li>Copy cookies in either format:
            <ul className="list-disc list-inside ml-4 mt-1 text-dark-400">
              <li>Header format: <code className="text-xs bg-dark-700 px-1 rounded">__cf_bm=...; _token=...</code></li>
              <li>JSON format: <code className="text-xs bg-dark-700 px-1 rounded">[{"{"}"name":"_token","value":"..."{"}"}]</code></li>
            </ul>
          </li>
          <li>Click "Test Cookies" to verify before adding</li>
        </ol>
      </div>
      
      {/* Accounts List */}
      {accounts.length === 0 ? (
        <div className="card text-center py-12">
          <Cookie className="w-16 h-16 text-dark-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Accounts Yet</h3>
          <p className="text-dark-400 mb-4">Add your first MiniMax account to get started</p>
          <button onClick={openAddModal} className="btn-primary">
            <Plus className="w-5 h-5" />
            Add Account
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-primary-600/50 transition-colors"
              onClick={() => navigate(`/accounts/${account.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  account.checkin_status === 'success' ? 'bg-green-600/20' :
                  account.checkin_status === 'failed' ? 'bg-red-600/20' : 'bg-yellow-600/20'
                }`}>
                  {account.checkin_status === 'success' ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : account.checkin_status === 'failed' ? (
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-yellow-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-lg">{account.account_name}</h3>
                  <p className="text-sm text-dark-400">
                    Status: <span className={`${
                      account.checkin_status === 'success' ? 'text-green-400' :
                      account.checkin_status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {account.checkin_status}
                    </span>
                    {' • '}
                    Credits: {account.current_credits.toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleTestAccount(account)}
                  disabled={testingId === account.id}
                  className="btn-ghost btn-sm text-blue-400 hover:bg-blue-600/20"
                  title="Test Account"
                >
                  {testingId === account.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => openEditModal(account)}
                  className="btn-ghost btn-sm"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(account)}
                  disabled={deletingId === account.id}
                  className="btn-ghost btn-sm text-red-400 hover:bg-red-600/20"
                  title="Delete"
                >
                  {deletingId === account.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {modalMode === 'add' ? 'Add Account' : 'Edit Account'}
              </h2>
              <button onClick={closeModal} className="text-dark-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account Name */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="My MiniMax Account"
                  className="input"
                  disabled={isSubmitting}
                />
              </div>
              
              {/* Cookies */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  Cookies
                  {modalMode === 'edit' && (
                    <span className="text-dark-500 ml-2">(leave empty to keep existing)</span>
                  )}
                </label>
                <div className="relative">
                  <textarea
                    value={formData.cookies}
                    onChange={(e) => {
                      setFormData({ ...formData, cookies: e.target.value });
                      setTestResult(null); // Reset test result when cookies change
                    }}
                    placeholder="Paste cookies in any format: JSON array or header string"
                    className="input min-h-[100px] font-mono text-sm pr-10"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookies(!showCookies)}
                    className="absolute right-3 top-3 text-dark-400 hover:text-white"
                  >
                    {showCookies ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-sm text-dark-500 mt-1">
                  Supports both JSON and header string formats
                </p>
              </div>
              
              {/* Test Button */}
              <button
                type="button"
                onClick={handleTestCookies}
                disabled={isTestingCookies || !formData.cookies}
                className="btn-secondary w-full"
              >
                {isTestingCookies ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="w-5 h-5" />
                    Test Cookies
                  </>
                )}
              </button>
              
              {/* Test Result */}
              {testResult && (
                <div className="p-4 rounded-lg bg-green-600/10 border border-green-600/20 space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Cookies Valid!</span>
                  </div>
                  
                  {testResult.user && (
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-dark-400" />
                      <span>User: {testResult.user.name}</span>
                    </div>
                  )}
                  
                  {testResult.credits && (
                    <div className="flex items-center gap-3">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span>Credits: {testResult.credits.remaining.toLocaleString()} remaining</span>
                    </div>
                  )}
                  
                  {testResult.checkin && (
                    <div className="flex items-center gap-3">
                      <Zap className={`w-4 h-4 ${testResult.checkin.alreadyCheckedIn ? 'text-green-400' : 'text-yellow-400'}`} />
                      <span>
                        {testResult.checkin.alreadyCheckedIn 
                          ? 'Already checked in today' 
                          : 'Can check in today'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    modalMode === 'add' ? 'Add Account' : 'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
