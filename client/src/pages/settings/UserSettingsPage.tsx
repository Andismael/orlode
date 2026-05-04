import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { User, Bell, Shield, Key } from 'lucide-react';
import { useLangStore } from '@/store/langStore';

const tabs = [
  { path: '/settings/profile', label: 'Profil', icon: User },
  { path: '/settings/notifications', label: 'Notifications', icon: Bell },
  { path: '/settings/api-keys', label: 'Clés API', icon: Key },
];

export default function UserSettingsPage() {
  const { t } = useLangStore();
  return (
    <div className="flex h-full">
      <div className="w-48 flex-shrink-0 border-r border-gray-100 bg-white p-3 space-y-0.5">
        <p className="text-xs font-semibold text-gray-400 uppercase px-3 mb-2">{`${t('settings')}`}</p>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink key={tab.path} to={tab.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`
              }>
              <Icon size={15} /> {tab.label}
            </NavLink>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
