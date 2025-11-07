/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

interface CropPanelProps {
  onApplyCrop: () => void;
  onResetCrop: () => void;
  onSetAspect: (aspect: number | undefined) => void;
  isLoading: boolean;
  isApplyCropEnabled: boolean;
  isCropActive: boolean;
}

type AspectRatioOption = {
  id: string;
  name: string;
  value: number | undefined;
};

const aspects: AspectRatioOption[] = [
    { id: 'free', name: 'Free', value: undefined },
    { id: '1:1', name: 'Square', value: 1 / 1 },
    { id: '16:9', name: '16:9', value: 16 / 9 },
    { id: '9:16', name: '9:16', value: 9 / 16 },
    { id: '4:3', name: '4:3', value: 4 / 3 },
    { id: '3:4', name: '3:4', value: 3 / 4 },
];

const CropPanel: React.FC<CropPanelProps> = ({ onApplyCrop, onResetCrop, onSetAspect, isLoading, isApplyCropEnabled, isCropActive }) => {
  const [activeAspectId, setActiveAspectId] = useState<string>('free');
  
  const handleAspectChange = (aspect: AspectRatioOption) => {
    setActiveAspectId(aspect.id);
    onSetAspect(aspect.value);
  }

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">Crop Image</h3>
      <p className="text-sm text-gray-400 -mt-2 text-center">Click and drag on the image to select an area. A rule-of-thirds grid will appear to guide you.</p>
      
      <div className="flex flex-col items-center gap-3 w-full">
        <span className="text-sm font-medium text-gray-400">Aspect Ratio:</span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-md">
            {aspects.map((aspect) => (
              <button
                key={aspect.id}
                onClick={() => handleAspectChange(aspect)}
                disabled={isLoading}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                  activeAspectId === aspect.id 
                  ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20' 
                  : 'bg-white/10 hover:bg-white/20 text-gray-200'
                }`}
              >
                {aspect.name}
              </button>
            ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-3 w-full max-w-sm">
          <button
              onClick={onResetCrop}
              disabled={isLoading || !isCropActive}
              className="w-full bg-white/10 border border-white/20 text-gray-200 font-bold py-3 px-6 rounded-lg transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
              Reset
          </button>
          <button
              onClick={onApplyCrop}
              disabled={isLoading || !isApplyCropEnabled}
              className="w-full bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          >
              Apply Crop
          </button>
      </div>
    </div>
  );
};

export default CropPanel;