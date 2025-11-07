/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { TextLayer } from '../App';

interface TextPanelProps {
  selectedLayer: TextLayer | undefined;
  onAddLayer: () => void;
  onUpdateLayer: (updates: Partial<TextLayer>) => void;
  isLoading: boolean;
}

const fonts = ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Impact', 'Comic Sans MS'];

const TextPanel: React.FC<TextPanelProps> = ({ selectedLayer, onAddLayer, onUpdateLayer, isLoading }) => {
  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-300">Text Editor</h3>
        <button
          onClick={onAddLayer}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
        >
          Add New Text
        </button>
      </div>

      {!selectedLayer ? (
        <div className="text-center text-gray-400 py-8">
          <p>Click "Add New Text" to start.</p>
          <p className="text-sm mt-1">Or, select a text layer on the image or in the Layers panel to edit it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="text-content" className="block text-sm font-medium text-gray-400 mb-1">Text</label>
            <input
              id="text-content"
              type="text"
              value={selectedLayer.content}
              onChange={(e) => onUpdateLayer({ content: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-white"
            />
          </div>
          <div>
            <label htmlFor="text-font" className="block text-sm font-medium text-gray-400 mb-1">Font</label>
            <select
              id="text-font"
              value={selectedLayer.font}
              onChange={(e) => onUpdateLayer({ font: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-white"
            >
              {fonts.map(font => <option key={font} value={font}>{font}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="text-size" className="block text-sm font-medium text-gray-400 mb-1">Size</label>
            <input
              id="text-size"
              type="number"
              value={selectedLayer.size}
              onChange={(e) => onUpdateLayer({ size: parseInt(e.target.value, 10) || 12 })}
              className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-white"
            />
          </div>
          <div className="col-span-1 md:col-span-2 flex items-center gap-4">
            <label htmlFor="text-color" className="block text-sm font-medium text-gray-400">Color</label>
            <input
              id="text-color"
              type="color"
              value={selectedLayer.color}
              onChange={(e) => onUpdateLayer({ color: e.target.value })}
              className="w-12 h-10 p-1 bg-gray-900 border border-gray-600 rounded-md cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TextPanel;
