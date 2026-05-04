import React from 'react';
import { useNavigate } from 'react-router-dom';
import BYOESetupWizard from '@/components/setup/BYOESetupWizard';

export default function SetupWizardPage() {
  const navigate = useNavigate();
  return <BYOESetupWizard onComplete={() => navigate('/dashboard')} />;
}
