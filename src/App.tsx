/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Mic2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Calculator, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Coins,
  MessageSquare,
  MessageCircle,
  Send,
  Headphones,
  ExternalLink,
  Upload,
  FileText,
  Image as ImageIcon,
  FileUp,
  RefreshCw,
  Edit3
} from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { analyzeStyle, askQuestion, StyleAnalysis } from './services/geminiService';
import { REVIEWS } from './data/reviews';
import { PREDEFINED_ANSWERS } from './data/predefinedAnswers';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pricing Categories
const BOOK_TYPES = [
  { id: 'prose', label: 'פרוזה רגילה', rate: 0.10, description: 'ספר פרוזה רגיל בעברית' },
  { id: 'non_fiction', label: 'ספר עיוני', rate: 0.11, description: 'ספר עיוני עם מונחים טכניים' },
  { id: 'complex', label: 'ספר מורכב', rate: 0.12, description: 'ציטוטים מהתנ"ך או מונחים טכניים' },
  { id: 'poetry', label: 'ספר שירה', rate: 1.5, description: 'ספר שירה (תמחור כספר ילדים)' },
  { id: 'children', label: 'ספר ילדים', rate: 1.5, description: 'ספר ילדים קצר מנוקד' },
  { id: 'children_effects', label: 'ספר ילדים + אפקטים', rate: 2.0, description: 'מנוקד בתוספת מוזיקה ואפקטים' },
];

const SUGGESTED_QUESTIONS = [
  "למה ספר קולי?",
  "למה ההשקעה הזו שווה?",
  "לפי מה נקבע התמחור?",
  "כיצד לבחור את הקריין המתאים לספר שלי?",
  "כמה זמן זה לוקח?",
  "אפשר לקריין לבד?",
  "מה לגבי AI?",
  "איך מתחילים?",
  "מה היתרון שלך?",
  "איזה ז'אנרים אתה מקריין?",
  "איך מקבלים את הקבצים?"
];

const LISTENING_LINKS = {
  prose: "https://www.e-vrit.co.il/Narrator/196/%D7%A8%D7%95%D7%93%D7%99%D7%94_%D7%A7%D7%95%D7%96%D7%9C%D7%95%D7%91%D7%A1%D7%A7%D7%99?srsltid=AfmBOopkrLAILz1l8TmdnJo1cqOWueSQivxsB52p-0aVMzOlfVKJtj9W&category=10&sort=3",
  thriller: "https://www.e-vrit.co.il/Narrator/196/%D7%A8%D7%95%D7%93%D7%99%D7%94_%D7%A7%D7%95%D7%96%D7%9C%D7%95%D7%91%D7%A1%D7%A7%D7%99?srsltid=AfmBOopkrLAILz1l8TmdnJo1cqOWueSQivxsB52p-0aVMzOlfVKJtj9W&category=3&sort=3",
  children: "https://www.e-vrit.co.il/Narrator/196/%D7%A8%D7%95%D7%93%D7%99%D7%94_%D7%A7%D7%95%D7%96%D7%9C%D7%95%D7%91%D7%A1%D7%A7%D7%99?srsltid=AfmBOopkrLAILz1l8TmdnJo1cqOWueSQivxsB52p-0aVMzOlfVKJtj9W&category=54&sort=3",
  non_fiction: "https://www.e-vrit.co.il/Narrator/196/%D7%A8%D7%95%D7%93%D7%99%D7%94_%D7%A7%D7%95%D7%96%D7%9C%D7%95%D7%91%D7%A1%D7%A7%D7%99?srsltid=AfmBOopkrLAILz1l8TmdnJo1cqOWueSQivxsB52p-0aVMzOlfVKJtj9W&category=4&sort=3"
};

const ROTATING_MESSAGES = [
  "מהדורה קולית היא כבר לא 'nice to have' - היא חובה!",
  "ויתרת על מהדורה קולית? ויתרת מראש על כ-20% מהשוק.",
  "ספר קולי הוא השקעה יחסית קטנה שמביאה חשיפה גדולה נוספת לאורך שנים.",
  "השם של הקריין על הספר שלך - פותח דלתות.",
  "הזמנה ישירה מקריין שהוא גם אולפן חוסכת לך הוצאות."
];

type Step = 'welcome' | 'excerpt' | 'analysis' | 'wordcount' | 'quote';

export default function App() {
  const [step, setStep] = useState<Step>('welcome');
  const [excerpt, setExcerpt] = useState('');
  const [wordCount, setWordCount] = useState<number>(50000);
  const [selectedType, setSelectedType] = useState(BOOK_TYPES[0].id);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotatingIndex, setRotatingIndex] = useState(0);
  const [reviewIndex, setReviewIndex] = useState(0);

  // Q&A State
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isEditingGenre, setIsEditingGenre] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        if (pdf.numPages > 4) {
          setError('ניתן להעלות עד 4 עמודי PDF לניתוח. אנא העלה קובץ קצר יותר.');
          setIsUploading(false);
          return;
        }

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          fullText += strings.join(' ') + '\n';
        }

        const words = fullText.trim().split(/\s+/).length;
        if (words > 3000) {
          setError('הטקסט ארוך מדי (מעל 3000 מילים). אנא העלה קטע קצר יותר.');
          setIsUploading(false);
          return;
        }

        setExcerpt(fullText);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        const words = text.trim().split(/\s+/).length;
        
        if (words > 3000) {
          setError('הטקסט ארוך מדי (מעל 3000 מילים). אנא העלה קטע קצר יותר.');
          setIsUploading(false);
          return;
        }
        
        setExcerpt(text);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          setExcerpt(`[IMAGE_UPLOAD]:${base64}`);
        };
        reader.readAsDataURL(file);
      } else {
        setError('סוג קובץ לא נתמך. אנא העלה PDF, Word או תמונה.');
      }
    } catch (err) {
      console.error(err);
      setError('אירעה שגיאה בקריאת הקובץ.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredReviews = useMemo(() => {
    let category = selectedType;
    if (category === 'complex') category = 'non_fiction';
    if (category === 'poetry' || category === 'children_effects') category = 'children';
    
    const filtered = REVIEWS.filter(r => r.category === category);
    return filtered.length > 0 ? filtered : REVIEWS.filter(r => r.category === 'prose');
  }, [selectedType]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotatingIndex((prev) => (prev + 1) % ROTATING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setReviewIndex((prev) => (prev + 1) % (filteredReviews.length || 1));
    }, 6000);
    return () => clearInterval(interval);
  }, [filteredReviews.length]);

  useEffect(() => {
    setReviewIndex(0);
  }, [selectedType]);

  const sliderConfig = useMemo(() => {
    const isShortForm = selectedType === 'poetry' || selectedType === 'children' || selectedType === 'children_effects';
    return isShortForm 
      ? { min: 100, max: 1200, step: 10, default: 500 }
      : { min: 10000, max: 300000, step: 500, default: 50000 };
  }, [selectedType]);

  useEffect(() => {
    if (wordCount < sliderConfig.min || wordCount > sliderConfig.max) {
      setWordCount(sliderConfig.default);
    }
  }, [selectedType, sliderConfig]);

  const handleAnalyze = async () => {
    if (!excerpt.trim()) return;
    
    const words = excerpt.trim().split(/\s+/).length;
    if (words > 3000 && !excerpt.startsWith('[IMAGE_UPLOAD]:')) {
      setError('הטקסט ארוך מדי (מעל 3000 מילים). אנא צמצם את הקטע לניתוח.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeStyle(excerpt);
      setAnalysis(result);
      setSelectedType(result.category);
      setStep('analysis');
    } catch (err) {
      console.error(err);
      setError('אירעה שגיאה בניתוח הטקסט. אנא נסה שנית.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAsk = async (q?: string) => {
    const query = q || question;
    if (!query.trim()) return;
    
    // Check for predefined answer
    if (PREDEFINED_ANSWERS[query]) {
      setAnswer(PREDEFINED_ANSWERS[query]);
      setQuestion(query);
      return;
    }

    setIsAsking(true);
    setQuestion(query);
    try {
      const res = await askQuestion(query);
      setAnswer(res);
    } catch (err) {
      setAnswer("מצטער, אירעה שגיאה בחיבור לעוזר האישי.");
    } finally {
      setIsAsking(false);
    }
  };

  const quote = useMemo(() => {
    if (typeof wordCount !== 'number') return null;
    const type = BOOK_TYPES.find(t => t.id === selectedType);
    if (!type) return null;
    
    const calculatedPrice = Math.round(wordCount * type.rate);
    const isMinimum = calculatedPrice < 300;
    const finalPrice = isMinimum ? 300 : calculatedPrice;
    
    return {
      total: finalPrice,
      isMinimum,
      estimatedHours: Math.ceil(wordCount / 7500),
    };
  }, [wordCount, selectedType]);

  const getListeningLink = () => {
    if (!analysis) return LISTENING_LINKS.prose;
    const genre = analysis.genre.toLowerCase();
    if (genre.includes('ילד')) return LISTENING_LINKS.children;
    if (genre.includes('מתח') || genre.includes('פעולה')) return LISTENING_LINKS.thriller;
    if (genre.includes('עיון') || genre.includes('עיוני')) return LISTENING_LINKS.non_fiction;
    return LISTENING_LINKS.prose;
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8"
          >
            <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-indigo-200">
              <Mic2 className="text-white w-12 h-12" />
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-black tracking-tight text-zinc-900 leading-tight">
                קריינות שמרימה לך את הספר
              </h1>
              <div className="h-12 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={rotatingIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-indigo-600 text-xl font-medium italic"
                  >
                    {ROTATING_MESSAGES[rotatingIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            <button 
              onClick={() => setStep('excerpt')}
              className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-2xl flex items-center gap-3 mx-auto"
            >
              בוא נבדוק את הספר שלך
              <ChevronLeft className="w-6 h-6" />
            </button>
          </motion.div>
        );

      case 'excerpt':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="text-indigo-600 w-6 h-6" />
        <h2 className="text-2xl font-bold">ניתוח סגנון הכתיבה</h2>
      </div>
      <p className="text-zinc-600">הדבק כאן 3-4 עמודים מתוך הספר (עד 3000 מילים) כדי שאוכל לנתח את סגנון הכתיבה ולתת הצעת מחיר בהתאם.</p>
      
      <div className="relative group">
        <textarea 
          value={excerpt.startsWith('[IMAGE_UPLOAD]:') ? 'קובץ תמונה הועלה בהצלחה' : excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="הדבק כאן את הטקסט..."
          className="w-full h-64 p-6 bg-white border border-zinc-200 rounded-3xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-lg leading-relaxed shadow-inner"
        />
        
        <div className="absolute bottom-4 right-4 flex gap-2">
          <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-600 p-3 rounded-2xl transition-all flex items-center gap-2 border border-zinc-200 shadow-sm">
            <FileUp className="w-5 h-5" />
            <span className="text-sm font-bold">העלה קובץ (עד 4 עמודי PDF / 3000 מילים)</span>
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.docx,image/*"
              onChange={handleFileUpload}
            />
          </label>
        </div>
        
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-3xl flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="font-bold text-indigo-900">מעבד קובץ...</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
              <button 
                onClick={() => setStep('welcome')}
                className="text-zinc-500 hover:text-zinc-800 font-medium flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                חזרה
              </button>
              <button 
                disabled={!excerpt.trim() || isLoading}
                onClick={handleAnalyze}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                נתח את הסגנון שלי
              </button>
            </div>
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm border border-red-100">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </motion.div>
        );

      case 'analysis':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-50 pb-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="text-amber-500 w-6 h-6" />
                  <h2 className="text-2xl font-bold">ניתוח סגנוני</h2>
                </div>
                <a 
                  href={getListeningLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-indigo-600 font-bold hover:underline bg-indigo-50 px-4 py-2 rounded-full text-sm"
                >
                  <Headphones className="w-4 h-4" />
                  האזן לסגנון דומה בקולי
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">ז'אנר</span>
                  <p className="text-lg font-semibold text-zinc-800">{analysis?.genre}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">טון כתיבה</span>
                  <p className="text-lg font-semibold text-zinc-800">{analysis?.tone}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">קטגוריית תמחור שזוהתה</span>
                  <button 
                    onClick={() => {
                      // Toggle a manual selection mode or just show the options
                      const nextStep = 'wordcount';
                      setStep(nextStep);
                    }}
                    className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    זה לא הז'אנר הנכון? תקן אותי
                  </button>
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-indigo-700">
                      {BOOK_TYPES.find(t => t.id === selectedType)?.label}
                    </p>
                    <p className="text-xs text-indigo-600">
                      {BOOK_TYPES.find(t => t.id === selectedType)?.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {BOOK_TYPES.filter(t => t.id !== selectedType).slice(0, 2).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedType(t.id)}
                        className="text-[10px] bg-white border border-indigo-200 text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        שנה ל{t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-zinc-700 leading-relaxed italic">"{analysis?.summary}"</p>
              </div>

              {/* Rotating Reviews Section */}
              <div className="pt-6 border-t border-zinc-100">
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">ביקורות על ספרים דומים שקריינתי:</h4>
                <div className="min-h-[120px] flex items-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={reviewIndex}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-3"
                    >
                      <p className="text-zinc-700 leading-relaxed italic text-lg">"{filteredReviews[reviewIndex]?.text}"</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-indigo-600">{filteredReviews[reviewIndex]?.book}</span>
                        <span className="text-zinc-400">/</span>
                        <span className="text-zinc-500 font-medium">{filteredReviews[reviewIndex]?.author}</span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button 
                onClick={() => setStep('excerpt')}
                className="text-zinc-500 hover:text-zinc-800 font-medium flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                שינוי טקסט
              </button>
              <button 
                onClick={() => setStep('wordcount')}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
              >
                המשך להצעת מחיר
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );

      case 'wordcount':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Calculator className="text-indigo-600 w-6 h-6" />
                <h2 className="text-2xl font-bold">פרטי הספר</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-indigo-900">סגנון הקריינות שנבחר:</p>
                    <button 
                      onClick={() => setIsEditingGenre(!isEditingGenre)}
                      className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      {isEditingGenre ? 'סגור עריכה' : 'שנה סגנון'}
                    </button>
                  </div>
                  
                  {!isEditingGenre ? (
                    <div className="p-4 bg-white rounded-2xl border border-indigo-200 text-right">
                      <span className="font-bold text-indigo-900 text-lg block">
                        {BOOK_TYPES.find(t => t.id === selectedType)?.label}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {BOOK_TYPES.find(t => t.id === selectedType)?.description}
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {BOOK_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => {
                            setSelectedType(type.id);
                            setIsEditingGenre(false);
                          }}
                          className={cn(
                            "p-3 rounded-xl border text-right transition-all flex flex-col gap-0.5",
                            selectedType === type.id 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                              : "bg-white border-zinc-200 text-zinc-700 hover:border-indigo-300"
                          )}
                        >
                          <span className="font-bold text-sm">{type.label}</span>
                          <span className={cn("text-[9px]", selectedType === type.id ? "text-indigo-100" : "text-zinc-400")}>
                            {type.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider">מספר מילים בספר</label>
                  <div className="text-3xl font-black text-indigo-600">
                    {Number(wordCount).toLocaleString()} <span className="text-sm font-bold text-zinc-400">מילים</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <input 
                    type="range"
                    min={sliderConfig.min}
                    max={sliderConfig.max}
                    step={sliderConfig.step}
                    value={wordCount}
                    onChange={(e) => setWordCount(Number(e.target.value))}
                    className="w-full h-3 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                    <span>{sliderConfig.min.toLocaleString()}</span>
                    <span>{(sliderConfig.max / 2).toLocaleString()}</span>
                    <span>{sliderConfig.max.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button 
                onClick={() => setStep('analysis')}
                className="text-zinc-500 hover:text-zinc-800 font-medium flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                חזרה לניתוח
              </button>
              <button 
                disabled={!wordCount || wordCount <= 0}
                onClick={() => setStep('quote')}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                קבל הצעת מחיר
                <CheckCircle2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );

      case 'quote':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="bg-indigo-600 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-200 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl" />
              
              <div className="relative z-10 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-medium opacity-90">הצעת המחיר שלך מוכנה</h2>
                  <div className="flex items-center justify-center gap-2 text-5xl font-black">
                    <span className="text-3xl font-bold opacity-80 mt-2">₪</span>
                    <span>{quote?.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2 mb-1 opacity-80">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">היקף</span>
                    </div>
                    <p className="text-lg font-bold">{wordCount.toLocaleString()} מילים</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2 mb-1 opacity-80">
                      <Loader2 className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">זמן משוער</span>
                    </div>
                    <p className="text-lg font-bold">כ-{quote?.estimatedHours} שעות קריינות</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-sm text-center opacity-80 leading-relaxed">
                    ההצעה מבוססת על תעריף של {BOOK_TYPES.find(t => t.id === selectedType)?.rate} ₪ למילה מוקלטת.
                  </p>
                  {quote?.isMinimum && (
                    <p className="text-xs text-center mt-2 font-bold bg-white/20 py-1 rounded-lg">
                      * שים לב: זהו סכום החיוב המינימלי (300 ₪)
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => {
                  const typeLabel = BOOK_TYPES.find(t => t.id === selectedType)?.label;
                  const message = `שלום, אני מעוניין להתחיל להקליט את הספר שלי.
הנה הנתונים מהניתוח:
ז'אנר: ${analysis?.genre}
טון: ${analysis?.tone}
סגנון קריינות: ${typeLabel}
מספר מילים: ${wordCount.toLocaleString()}
זמן משוער: כ-${quote?.estimatedHours} שעות קריינות
הצעת מחיר: ${quote?.total.toLocaleString()} ₪`;
                  
                  const encodedMessage = encodeURIComponent(message);
                  window.open(`https://wa.me/972544447551?text=${encodedMessage}`, '_blank');
                }}
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-bold text-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                <MessageCircle className="w-6 h-6" />
                בוא נתחיל להקליט!
              </button>
              <button 
                onClick={() => setStep('welcome')}
                className="w-full py-4 text-zinc-500 hover:text-zinc-800 font-semibold transition-all"
              >
                התחל מחדש
              </button>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-6 sm:px-12 bg-zinc-50">
      <div className="w-full max-w-2xl text-center mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative inline-block w-full max-w-lg"
        >
          {/* Custom SVG Illustration: Headphones lifting yellow books */}
          <div className="w-full aspect-video bg-zinc-100 rounded-3xl shadow-2xl border-4 border-white mb-6 flex items-center justify-center overflow-hidden relative">
            <svg viewBox="0 0 400 300" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              {/* Background */}
              <rect width="400" height="300" fill="#f4f4f5" />
              
              {/* Crane Cable */}
              <line x1="200" y1="20" x2="200" y2="120" stroke="#a1a1aa" strokeWidth="3" strokeDasharray="6,4" />
              
              {/* Headphones (The Crane) */}
              <motion.g
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <path d="M120 150 A80 80 0 0 1 280 150" fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" />
                <rect x="100" y="150" width="30" height="50" rx="8" fill="#ffffff" />
                <rect x="270" y="150" width="30" height="50" rx="8" fill="#ffffff" />
                
                {/* Lifting Hook/Cable from Headphones */}
                <path d="M200 70 L200 160" stroke="#ffffff" strokeWidth="4" />
                <path d="M180 160 L220 160 L200 180 Z" fill="#ffffff" />
              </motion.g>

              {/* Stack of Yellow Books */}
              <motion.g
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <rect x="140" y="180" width="120" height="15" rx="2" fill="#facc15" stroke="#eab308" strokeWidth="1" />
                <rect x="140" y="195" width="120" height="15" rx="2" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <rect x="140" y="210" width="120" height="15" rx="2" fill="#facc15" stroke="#eab308" strokeWidth="1" />
                <rect x="140" y="225" width="120" height="15" rx="2" fill="#fde047" stroke="#eab308" strokeWidth="1" />
                <rect x="140" y="240" width="120" height="15" rx="2" fill="#facc15" stroke="#eab308" strokeWidth="1" />
                
                {/* Book Labels */}
                <rect x="150" y="185" width="40" height="2" fill="#ca8a04" opacity="0.3" />
                <rect x="150" y="200" width="40" height="2" fill="#ca8a04" opacity="0.3" />
                <rect x="150" y="215" width="40" height="2" fill="#ca8a04" opacity="0.3" />
              </motion.g>
            </svg>
          </div>
          
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white px-8 py-3 rounded-2xl shadow-lg border border-zinc-100 whitespace-nowrap">
            <h2 className="text-2xl font-black text-indigo-600">רודיה קוזלובסקי - קריינות מקצועית לספרים</h2>
          </div>
        </motion.div>
      </div>

      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>

        {/* Q&A Section */}
        <div className="mt-20 pt-12 border-t border-zinc-200">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 space-y-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="text-indigo-600 w-6 h-6" />
              <h3 className="text-xl font-bold">יש לך שאלות נוספות?</h3>
            </div>
            <p className="text-zinc-500">שאל אותי כל דבר על הפקת ספר קולי, עלויות, תהליך העבודה או למה זה חשוב לספר שלך.</p>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAsk(q)}
                    className="text-xs bg-zinc-100 hover:bg-indigo-100 text-zinc-600 hover:text-indigo-700 px-3 py-2 rounded-full transition-colors border border-zinc-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                  placeholder="למשל: למה כדאי להשקיע בספר קולי?"
                  className="flex-1 p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button 
                  onClick={() => handleAsk()}
                  disabled={isAsking || !question.trim()}
                  className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  {isAsking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>

              <AnimatePresence>
                {answer && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-900 leading-relaxed"
                  >
                    {answer}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <footer className="mt-12 text-zinc-400 text-sm flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4" />
          <span>מערכת הצעות מחיר חכמה | רודיה קוזלובסקי</span>
        </div>
        <p className="text-xs opacity-60 italic">"קריינות מקצועית ללא פשרות והחייאת המילים שלך"</p>
      </footer>
    </div>
  );
}
