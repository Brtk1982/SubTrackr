import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  TrendingUp,
  X,
  Bell,
  CreditCard,
  Info
} from 'lucide-react';

const APP_NAME = 'SubTrackr'; // change this to your app name

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [showAbout, setShowAbout] = useState(false);

  const importInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    billingCycle: 'monthly',
    nextBilling: '',
    category: 'entertainment'
  });

  useEffect(() => {
    loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Important: only save AFTER we've attempted loading
    if (hasLoaded) saveSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions, hasLoaded]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAbout(false);
        setShowForm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const loadSubscriptions = async () => {
    try {
      const result = await window.storage.get('subscriptions');
      if (result) setSubscriptions(JSON.parse(result.value));
    } catch (error) {
      console.log('No saved subscriptions yet');
    } finally {
      setHasLoaded(true);
    }
  };

  const saveSubscriptions = async () => {
    try {
      await window.storage.set('subscriptions', JSON.stringify(subscriptions));
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const addSubscription = () => {
    if (formData.name && formData.cost && formData.nextBilling) {
      setSubscriptions([...subscriptions, { ...formData, id: Date.now() }]);
      setFormData({
        name: '',
        cost: '',
        billingCycle: 'monthly',
        nextBilling: '',
        category: 'entertainment'
      });
      setShowForm(false);
    }
  };

  const deleteSubscription = (id) => {
    setSubscriptions(subscriptions.filter((sub) => sub.id !== id));
  };

  // --- Export / Import (no accounts, local backup) ---
  const exportData = () => {
    const blob = new Blob([JSON.stringify(subscriptions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${APP_NAME.toLowerCase()}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'));
        if (!Array.isArray(parsed)) throw new Error('Backup must be an array');

        const withIds = parsed.map((s) => ({
          ...s,
          id: s.id ?? Date.now() + Math.random()
        }));

        setSubscriptions(withIds);
        if (importInputRef.current) importInputRef.current.value = ''; // allow re-import same file
      } catch (e) {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  // Monthly Total = monthly + yearly/12
  const calculateMonthlyTotal = () => {
    return subscriptions
      .reduce((total, sub) => {
        const cost = parseFloat(sub.cost);
        if (!Number.isFinite(cost)) return total;
        if (sub.billingCycle === 'monthly') return total + cost;
        if (sub.billingCycle === 'yearly') return total + cost / 12;
        return total;
      }, 0)
      .toFixed(2);
  };

  const calculateYearlyTotal = () => {
    return subscriptions
      .reduce((total, sub) => {
        const cost = parseFloat(sub.cost);
        if (!Number.isFinite(cost)) return total;
        if (sub.billingCycle === 'monthly') return total + cost * 12;
        if (sub.billingCycle === 'yearly') return total + cost;
        return total;
      }, 0)
      .toFixed(2);
  };

  // Annual equivalent per subscription
  const calculateAnnualEquivalent = (sub) => {
    const cost = parseFloat(sub.cost);
    if (!Number.isFinite(cost)) return '0.00';
    if (sub.billingCycle === 'monthly') return (cost * 12).toFixed(2);
    if (sub.billingCycle === 'yearly') return cost.toFixed(2);
    return '0.00';
  };

  // --- date helpers (avoid timezone drift on YYYY-MM-DD) ---
  const parseLocalDate = (yyyyMmDd) => {
    if (!yyyyMmDd) return null;
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };

  const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  };

  const daysBetween = (a, b) => {
    const ms = b.getTime() - a.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  };

  const getDueLabel = (nextBilling) => {
    const today = startOfToday();
    const due = parseLocalDate(nextBilling);
    if (!due) return null;

    const diff = daysBetween(today, due);
    if (diff < 0)
      return {
        text: `Overdue by ${Math.abs(diff)}d`,
        tone: 'text-red-200 bg-red-500/10 border-red-500/20'
      };
    if (diff === 0)
      return {
        text: 'Due today',
        tone: 'text-amber-200 bg-amber-500/10 border-amber-500/20'
      };
    return {
      text: `Due in ${diff}d`,
      tone: 'text-slate-200 bg-white/5 border-white/10'
    };
  };

  // Upcoming = due within NEXT 10 days
  const getUpcomingRenewals = () => {
    const today = startOfToday();
    const tenDaysFromNow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10);

    return subscriptions
      .filter((sub) => {
        const renewalDate = parseLocalDate(sub.nextBilling);
        if (!renewalDate) return false;
        return renewalDate >= today && renewalDate <= tenDaysFromNow;
      })
      .sort((a, b) => parseLocalDate(a.nextBilling) - parseLocalDate(b.nextBilling));
  };

  const categoryIcons = {
    entertainment: '🎬',
    productivity: '💼',
    fitness: '💪',
    news: '📰',
    other: '📦'
  };

  const categoryGradients = {
    entertainment: 'from-purple-500/90 to-pink-500/90',
    productivity: 'from-sky-500/90 to-cyan-500/90',
    fitness: 'from-emerald-500/90 to-green-500/90',
    news: 'from-amber-500/90 to-orange-500/90',
    other: 'from-slate-500/90 to-zinc-500/90'
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Subtle “Apple-ish” gradient haze */}
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(168,85,247,0.22),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(236,72,153,0.16),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.10),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/35" />
      </div>

      <div className="relative p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="relative text-center mb-10 md:mb-12">
            {/* About icon (top-right) */}
            <button
              onClick={() => setShowAbout(true)}
              className="absolute right-0 top-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-slate-300 border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-colors"
              aria-label="About this app"
            >
              <Info size={16} />
              <span className="text-sm font-medium">About</span>
            </button>

            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-lg shadow-purple-500/10 border border-white/10 bg-white/[0.04] backdrop-blur-md">
              <div className="rounded-xl p-2 bg-gradient-to-br from-purple-500/80 to-pink-500/70">
                <CreditCard className="text-white" size={22} />
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">{APP_NAME}</h1>
            <p className="mt-2 text-slate-300 text-base md:text-lg">Quiet control over recurring payments</p>
          </header>

          {/* About Modal */}
          {showAbout && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowAbout(false)}
              />

              <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
                <div className="h-px bg-gradient-to-r from-transparent via-purple-500/25 to-transparent" />

                <div className="p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl p-2 border border-white/10 bg-white/[0.03]">
                        <Info size={18} className="text-white/80" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg md:text-xl font-semibold tracking-tight text-white">
                          About {APP_NAME}
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">
                          A local-first subscription dashboard. No accounts. No noise.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowAbout(false)}
                      className="rounded-lg p-2 text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                      <p className="text-white font-semibold">What it does</p>
                      <ul className="mt-2 text-slate-300 text-sm space-y-1 list-disc pl-5">
                        <li>Tracks monthly and yearly subscriptions.</li>
                        <li>Shows totals (monthly includes yearly ÷ 12).</li>
                        <li>Highlights renewals due in the next 10 days.</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                      <p className="text-white font-semibold">What it does not do</p>
                      <ul className="mt-2 text-slate-300 text-sm space-y-1 list-disc pl-5">
                        <li>No bank connection, no auto-detection.</li>
                        <li>No automatic cancellations.</li>
                        <li>No sync across devices unless you export/import.</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                      <p className="text-white font-semibold">No account tradeoffs</p>
                      <ul className="mt-2 text-slate-300 text-sm space-y-1 list-disc pl-5">
                        <li>Your data stays on this device and browser.</li>
                        <li>If you clear browser storage, data can be lost.</li>
                        <li>Different device means a fresh empty list.</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                      <p className="text-white font-semibold">Benefits</p>
                      <ul className="mt-2 text-slate-300 text-sm space-y-1 list-disc pl-5">
                        <li>Fast, private, and works without signup.</li>
                        <li>No tracking, no profiles, no “account gravity”.</li>
                        <li>Back up anytime with Export, restore with Import.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-4 text-left">
                    <p className="text-emerald-200 font-semibold">Best practice</p>
                    <p className="mt-1 text-slate-200 text-sm">
                      Use <span className="font-semibold">Export</span> occasionally to keep a backup file.
                      You can Import it on another device with zero accounts.
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 justify-end">
                    <button
                      onClick={() => setShowAbout(false)}
                      className="rounded-xl px-5 py-3 font-semibold border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-8">
            {/* Monthly Total */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-xl shadow-black/20 hover:bg-white/[0.06] hover:border-white/15 transition-colors">
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-medium">Monthly total</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">${calculateMonthlyTotal()}</p>
                  <p className="mt-1 text-slate-400 text-xs">per month</p>
                  <p className="mt-1 text-slate-400/80 text-[11px]">includes annual plans ÷ 12</p>
                </div>
                <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.03]">
                  <DollarSign className="text-white/90" size={26} />
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
            </div>

            {/* Yearly Total */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-xl shadow-black/20 hover:bg-white/[0.06] hover:border-white/15 transition-colors">
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-medium">Yearly total</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">${calculateYearlyTotal()}</p>
                  <p className="mt-1 text-slate-400 text-xs">per year</p>
                </div>
                <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.03]">
                  <TrendingUp className="text-white/90" size={26} />
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />
            </div>

            {/* Active Subs */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-xl shadow-black/20 hover:bg-white/[0.06] hover:border-white/15 transition-colors">
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-medium">Active subs</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">{subscriptions.length}</p>
                  <p className="mt-1 text-slate-400 text-xs">subscriptions</p>
                </div>
                <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.03]">
                  <Calendar className="text-white/90" size={26} />
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-pink-500/20 to-transparent" />
            </div>
          </div>

          {/* Upcoming Renewals (within 10 days) */}
          {getUpcomingRenewals().length > 0 && (
            <div className="mb-8 mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-xl shadow-black/20 overflow-hidden">
              <div className="h-px bg-gradient-to-r from-transparent via-amber-500/25 to-transparent" />
              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative rounded-xl p-2 border border-amber-500/25 bg-amber-500/10">
                      <span className="absolute -top-1 -right-1">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300/70" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-200" />
                        </span>
                      </span>
                      <Bell className="text-amber-200" size={18} />
                    </div>

                    <div>
                      <h3 className="font-semibold text-white text-base">Upcoming renewals</h3>
                      <p className="text-slate-400 text-sm">Next 10 days</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {getUpcomingRenewals().map((sub) => {
                    const label = getDueLabel(sub.nextBilling);
                    return (
                      <div
                        key={sub.id}
                        className="flex justify-between items-center rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{categoryIcons[sub.category]}</span>
                          <div className="flex flex-col">
                            <span className="text-white font-medium">{sub.name}</span>
                            {label && (
                              <span className={`mt-1 inline-flex w-fit px-2 py-1 rounded-lg border text-xs ${label.tone}`}>
                                {label.text}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-white font-semibold">${sub.cost}</div>
                          <div className="text-slate-400 text-sm">{parseLocalDate(sub.nextBilling)?.toLocaleDateString()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Actions: Add + Export/Import */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-3 rounded-xl px-6 py-3 font-semibold border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition-colors shadow-lg shadow-black/20"
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/80 to-pink-500/70 border border-white/10">
                <Plus size={18} />
              </span>
              Add subscription
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => importData(e.target.files?.[0])}
            />

            <button
              onClick={exportData}
              className="rounded-xl px-5 py-3 font-semibold border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              Export
            </button>

            <button
              onClick={() => importInputRef.current?.click()}
              className="rounded-xl px-5 py-3 font-semibold border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              Import
            </button>
          </div>

          {/* Add Form */}
          {showForm && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-xl shadow-black/20 mb-8 overflow-hidden">
              <div className="h-px bg-gradient-to-r from-transparent via-purple-500/25 to-transparent" />

              <div className="p-7">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-white tracking-tight">New subscription</h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="rounded-lg p-2 text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Service name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-white/15 transition"
                  />

                  <input
                    type="number"
                    placeholder="Cost"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-white/15 transition"
                  />

                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-white/15 transition"
                  >
                    <option value="monthly" className="bg-slate-900">Monthly</option>
                    <option value="yearly" className="bg-slate-900">Yearly</option>
                  </select>

                  <input
                    type="date"
                    value={formData.nextBilling}
                    onChange={(e) => setFormData({ ...formData, nextBilling: e.target.value })}
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-white/15 transition"
                  />

                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-white/15 transition md:col-span-2"
                  >
                    <option value="entertainment" className="bg-slate-900">🎬 Entertainment</option>
                    <option value="productivity" className="bg-slate-900">💼 Productivity</option>
                    <option value="fitness" className="bg-slate-900">💪 Fitness</option>
                    <option value="news" className="bg-slate-900">📰 News & Media</option>
                    <option value="other" className="bg-slate-900">📦 Other</option>
                  </select>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={addSubscription}
                    className="rounded-xl px-5 py-3 font-semibold border border-white/10 bg-gradient-to-r from-emerald-500/75 to-green-500/75 hover:from-emerald-500/90 hover:to-green-500/90 transition-colors shadow-lg shadow-black/20"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="rounded-xl px-5 py-3 font-semibold border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Subscriptions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-xl shadow-black/20 hover:bg-white/[0.06] hover:border-white/15 transition-colors group"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl p-[1px] bg-gradient-to-br from-white/10 to-white/0">
                        <div className={`rounded-2xl p-3 bg-gradient-to-br ${categoryGradients[sub.category]} shadow-sm`}>
                          <span className="text-2xl">{categoryIcons[sub.category]}</span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white leading-tight">{sub.name}</h3>
                        <p className="text-slate-400 text-sm capitalize">{sub.category}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteSubscription(sub.id)}
                      className="rounded-lg p-2 text-red-300/80 hover:text-red-200 hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Delete subscription"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <span className="text-slate-400 text-sm">Amount</span>
                      <span className="font-semibold text-white">${sub.cost}</span>
                    </div>

                    <div className="flex justify-between items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <span className="text-slate-400 text-sm">Billing</span>
                      <span className="font-medium text-white capitalize">{sub.billingCycle}</span>
                    </div>

                    <div className="flex justify-between items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <span className="text-slate-400 text-sm">Annual cost</span>
                      <span className="font-medium text-white">${calculateAnnualEquivalent(sub)}</span>
                    </div>

                    <div className="flex justify-between items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <span className="text-slate-400 text-sm">Next billing</span>
                      <span className="font-medium text-white">{parseLocalDate(sub.nextBilling)?.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {subscriptions.length === 0 && !showForm && (
            <div className="text-center py-16 md:py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/[0.04] border border-white/10 rounded-2xl mb-5 backdrop-blur-md">
                <CreditCard className="text-white/60" size={28} />
              </div>
              <p className="text-slate-200 text-lg font-medium">No subscriptions yet</p>
              <p className="text-slate-400 mt-1">Add your first one to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

