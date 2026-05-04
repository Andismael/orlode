import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { Mail, ArrowLeft } from 'lucide-react';
import { auth } from '@/services/firebase';

export default function VerifyEmailPage() {
  const [sent, setSent] = useState(false);

  const resend = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      setSent(true);
    }
  };

  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
        style={{ background: 'linear-gradient(135deg,#0019FF,#0092FF)' }}>
        <Mail size={28} className="text-white" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Vérifiez votre email</h1>
      <p className="text-sm text-gray-500 leading-relaxed mb-2">
        Un email de vérification a été envoyé à
      </p>
      <p className="text-sm font-semibold text-gray-900 mb-7">
        {auth.currentUser?.email}
      </p>

      {sent && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 mb-5">
          Email renvoyé avec succès !
        </div>
      )}

      <button onClick={resend}
        className="w-full py-2.5 rounded-xl text-white text-sm font-semibold mb-4 transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#0019FF,#0092FF)' }}>
        Renvoyer l'email
      </button>

      <Link to="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ArrowLeft size={13} />
        Retour à la connexion
      </Link>
    </div>
  );
}
