import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#020305] transition cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install Android App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Install APK / PWA</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#07080b] border border-cyan-500/35 p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Install Brahma AI Evo on Phone</span>
            </h3>
            {isIOS ? (
              <p className="text-xs text-slate-300 leading-relaxed">
                1. Safari-র <strong>Share</strong> বাটনে ট্যাপ করুন।<br />
                2. নিচে স্ক্রল করে <strong>Add to Home Screen</strong> নির্বাচন করুন।
              </p>
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed">
                1. আপনার Android ফোনের Chrome ব্রাউজারে এই অ্যাপের URL ওপেন করুন।<br />
                2. উপরের <strong>⋮ মেনু</strong> → <strong>Install App</strong> বা <strong>Add to Home Screen</strong> ট্যাপ করুন — অ্যাপটি পূর্ণাঙ্গ Android Standalone অ্যাপ হিসেবে ইনস্টল হয়ে যাবে।
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-xl bg-cyan-400 hover:bg-cyan-300 py-2 text-xs font-bold text-[#020305] uppercase tracking-wider cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/90 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-[#020305] shadow-lg">
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>Offline Mode — Cached Android App Assets Active</span>
    </div>
  );
};
