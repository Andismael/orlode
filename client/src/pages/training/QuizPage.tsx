import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Trophy, CheckCircle, XCircle } from 'lucide-react';

interface Question { id: string; text: string; options: string[]; correct: number; explanation?: string; }
interface Quiz { id: string; title: string; questions: Question[]; }

export default function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { t } = useLangStore();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/training/quizzes/${quizId}`).then(r => setQuiz(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [quizId]);

  const question = quiz?.questions[current];

  const choose = (idx: number) => { if (selected === null) setSelected(idx); };

  const next = () => {
    const newAnswers = [...answers, selected ?? -1];
    setAnswers(newAnswers);
    if (current < (quiz?.questions.length ?? 0) - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
    } else {
      setFinished(true);
      api.post(`/training/quizzes/${quizId}/submit`, { answers: newAnswers }).catch(() => {});
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">{`${t('loading')}`}</div>;
  if (!quiz) return <div className="p-6 text-sm text-red-500">Quiz introuvable</div>;

  if (finished) {
    const score = answers.filter((a, i) => a === quiz.questions[i].correct).length;
    const pct = Math.round((score / quiz.questions.length) * 100);
    return (
      <div className="flex items-center justify-center min-h-full p-6">
        <div className="text-center max-w-sm">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${pct >= 70 ? 'bg-green-100' : 'bg-red-100'}`}>
            {pct >= 70 ? <Trophy size={36} className="text-green-500" /> : <XCircle size={36} className="text-red-500" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{pct}%</h2>
          <p className="text-gray-600">{score}/{quiz.questions.length} bonnes réponses</p>
          {pct >= 70 && <p className="text-green-600 font-medium mt-2">🏆 Badge obtenu !</p>}
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => navigate('/training')} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Retour formations</button>
            {pct < 70 && <button onClick={() => { setCurrent(0); setAnswers([]); setFinished(false); setSelected(null); }} className="px-4 py-2 text-white rounded-lg text-sm" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>Réessayer</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-gray-900">{quiz.title}</h1>
        <span className="text-sm text-gray-500">{current + 1} / {quiz.questions.length}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${((current + 1) / quiz.questions.length) * 100}%`, background: 'linear-gradient(90deg, #0019FF, #0092FF)' }} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">{question?.text}</h2>
        <div className="space-y-3">
          {question?.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = selected !== null && i === question.correct;
            const isWrong = isSelected && i !== question.correct;
            return (
              <button key={i} onClick={() => choose(i)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  isCorrect ? 'border-green-500 bg-green-50' : isWrong ? 'border-red-500 bg-red-50' : isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}>
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isCorrect ? 'bg-green-500 text-white' : isWrong ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm text-gray-800">{opt}</span>
                  {isCorrect && <CheckCircle size={16} className="text-green-500 ml-auto" />}
                  {isWrong && <XCircle size={16} className="text-red-500 ml-auto" />}
                </div>
              </button>
            );
          })}
        </div>
        {selected !== null && question?.explanation && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            {question.explanation}
          </div>
        )}
      </div>
      <button onClick={next} disabled={selected === null}
        className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
        {current < quiz.questions.length - 1 ? 'Question suivante →' : 'Voir les résultats'}
      </button>
    </div>
  );
}
