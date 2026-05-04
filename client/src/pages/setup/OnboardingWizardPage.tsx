import React from 'react';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default function OnboardingWizardPage() {
  return <OnboardingWizard onComplete={() => window.location.href = '/'} />;
}
