/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState } from 'react';
import type { TextLayer } from '../App';
import { EyeIcon, TrashIcon } from './icons';

interface LayerPanelProps {
  layers: TextLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, updates: Partial<TextLayer>) => void;
  onRemoveLayer: (id: string) => void;
  onReorderLayers: (sourceIndex: number, destIndex: number) => void;
  onMergeLayers: () => void;
  isLoading: boolean;
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onRemoveLayer,
  onReorderLayers,
  onMergeLayers,
  isLoading,
}) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragOverItem.current = index;
    setDragOverIndex(index);
  };
  
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
        onReorderLayers(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDragOverIndex(null);
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Layers</h3>
      
      <div className="flex flex-col-reverse gap-2">
        {layers.length > 0 ? (
          layers.map((layer, index) => (
            <div
              key={layer.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => onSelectLayer(layer.id)}
              className={`layer-item p-2 rounded-md border transition-all duration-150 flex items-center gap-3 cursor-grab active:cursor-grabbing ${selectedLayerId === layer.id ? 'selected bg-blue-500/20 border-blue-500/50' : 'bg-gray-900/50 border-gray-700'} ${dragOverIndex === index ? 'drag-over' : ''} ${dragItem.current === index ? 'dragging' : ''}`}
            >
                <div className="flex-grow truncate text-gray-200">{layer.content}</div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">Opacity:</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={layer.opacity}
                            onChange={(e) => onUpdateLayer(layer.id, { opacity: parseFloat(e.target.value) })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-20"
                            />
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }} className={`p-1 rounded-md ${layer.visible ? 'text-gray-200' : 'text-gray-500'}`}>
                        <EyeIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveLayer(layer.id); }} className="p-1 rounded-md text-red-400 hover:bg-red-500/20">
                        <TrashIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-4">No layers yet. Add some text from the 'Text' tab!</p>
        )}
      </div>

      {layers.length > 0 && (
         <button
            onClick={onMergeLayers}
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
            Merge Layers to Image
        </button>
      )}
    </div>
  );
};

export default LayerPanel;
