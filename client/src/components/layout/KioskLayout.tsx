import React from 'react';
import { Outlet } from 'react-router-dom';

export default function KioskLayout() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 select-none">
      <Outlet />
    </div>
  );
}
