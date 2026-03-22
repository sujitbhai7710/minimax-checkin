// Accounts page - Add/Edit/Delete accounts

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsApi } from '../utils/api';
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
  Cookie
} from 'lucide-react';
import toast from 'react-hot-toast';

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
    setShowModal(true);
  };
  
  const openEditModal = (account: MiniMaxAccount) => {
    setModalMode('edit');
    setEditingAccount(account);
    setFormData({ 
      account_name: account.account_name, 
      cookies: '' // Don't show existing cookies
    });
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setEditingAccount(null);
    setFormData({ account_name: '', cookies: '' });
    setShowCookies(false);
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
          <li>Go to Network tab</li>
          <li>Refresh the page</li>
          <li>Click on any request to agent.minimax.io</li>
          <li>Copy the Cookie header from Request Headers</li>
          <li>Paste it in the cookies field below</li>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
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
                    onChange={(e) => setFormData({ ...formData, cookies: e.target.value })}
                    placeholder="__cf_bm=...; _token=..."
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
                  Paste the full Cookie header from your browser
                </p>
              </div>
              
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
