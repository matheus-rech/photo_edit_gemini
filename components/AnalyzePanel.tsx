/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Spinner from './Spinner';

interface AnalyzePanelProps {
  onAnalyze: (query: string) => void;
  onApply: () => void;
  onClear: () => void;
  isLoading: boolean;
  analysisResult: string | null;
  canApply: boolean;
}

const AnalyzePanel: React.FC<AnalyzePanelProps> = ({ onAnalyze, onApply, onClear, isLoading, analysisResult, canApply }) => {
  const [query, setQuery] = useState('');

  const exampleQueries = [
    "How can I make this look more professional?",
    "Is this photo good enough for my dating profile?",
    "What could improve the composition here?",
    "Critique the lighting in this shot.",
  ];

  const handleAnalyze = () => {
    if (query.trim()) {
      onAnalyze(query);
    }
  };
  
  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Analyze & Improve</h3>
      <p className="text-sm text-gray-400 -mt-2 text-center">Get expert feedback and one-click improvements from AI.</p>
      
      {!analysisResult && !isLoading && (
         <div className="flex flex-col items-center gap-4">
            <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about your photo... e.g., 'Is this picture cool enough to be posted?'"
                className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-purple-500 focus:outline-none transition h-24 resize-none text-base"
                disabled={isLoading}
            />
            <div className="text-xs text-gray-500 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 w-full max-w-lg">
              {exampleQueries.map(q => (
                <button key={q} onClick={() => setQuery(q)} className="text-left hover:text-purple-400 transition-colors p-1">{q}</button>
              ))}
            </div>
            <button
                onClick={handleAnalyze}
                className="w-full max-w-sm bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !query.trim()}
            >
                Analyze Image
            </button>
        </div>
      )}

      {isLoading && !analysisResult && (
          <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px]">
              <Spinner />
              <p className="text-gray-300">AI is analyzing your image...</p>
              <p className="text-sm text-gray-500">(This uses our most powerful model and may take a moment)</p>
          </div>
      )}

      {analysisResult && !isLoading && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
            <h4 className="text-md font-semibold text-gray-200">AI Feedback:</h4>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {analysisResult}
            </div>
            {canApply && (
                <button
                    onClick={onApply}
                    className="w-full bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
                >
                    Apply Suggested Edit
                </button>
            )}
            <button
              onClick={onClear}
              className="w-full bg-white/10 text-gray-300 font-semibold py-2 px-4 rounded-lg hover:bg-white/20 transition-colors"
            >
              Analyze Again
            </button>
        </div>
      )}
    </div>
  );
};

export default AnalyzePanel;
