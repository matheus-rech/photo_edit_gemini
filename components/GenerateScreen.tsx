/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import Spinner from './Spinner';
import { ChevronLeftIcon, MagicWandIcon, UploadIcon, XIcon } from './icons';

interface GenerateScreenProps {
  onGenerate: (prompt: string, aspectRatio: string, images: File[]) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const aspectRatios = [
    { name: 'Square', value: '1:1' },
    { name: 'Portrait', value: '9:16' },
    { name: 'Landscape', value: '16:9' },
    { name: 'Wide', value: '4:3' },
    { name: 'Tall', value: '3:4' },
];

const MAX_IMAGES = 3;

const GenerateScreen: React.FC<GenerateScreenProps> = ({ onGenerate, onCancel, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [activeAspect, setActiveAspect] = useState('1:1');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, MAX_IMAGES - images.length);
    
    if (newFiles.length > 0) {
      setImages(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  }, [images.length]);

  const handleRemoveImage = useCallback((indexToRemove: number) => {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    setImagePreviews(prev => {
        const urlToRevoke = prev[indexToRemove];
        URL.revokeObjectURL(urlToRevoke);
        return prev.filter((_, index) => index !== indexToRemove);
    });
  }, []);


  const handleGenerateClick = () => {
      if (prompt.trim() && !isLoading) {
          onGenerate(prompt, activeAspect, images);
      }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-6 animate-fade-in text-center p-4">
        <button onClick={onCancel} className="absolute top-28 left-4 md:left-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50" disabled={isLoading}>
            <ChevronLeftIcon className="w-5 h-5" />
            Back to Home
        </button>
        
        <div className="flex flex-col items-center gap-4 mt-12 md:mt-0">
            <MagicWandIcon className="w-16 h-16 text-purple-400" />
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-100">Create an Image with AI</h1>
            <p className="max-w-2xl text-lg text-gray-400">
                Describe anything you can imagine, and let AI bring it to life. Be as descriptive as you like.
            </p>
        </div>


        {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px]">
                <Spinner />
                <p className="text-gray-300">Generating your masterpiece...</p>
                <p className="text-sm text-gray-500">(This can take up to a minute)</p>
            </div>
        ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleGenerateClick(); }} className="w-full flex flex-col items-center gap-6 mt-6">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A cinematic shot of a raccoon in a library, wearing a tiny wizard hat, dramatic lighting"
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition h-32 resize-none"
                    disabled={isLoading}
                    aria-label="Image generation prompt"
                />

                <div className="w-full flex flex-col items-center gap-4 p-4 bg-gray-800/50 border border-gray-700/80 rounded-lg">
                  <h3 className="text-md font-medium text-gray-400">Reference Images (Optional)</h3>
                  <p className="text-sm text-gray-500 -mt-3">Upload up to {MAX_IMAGES} images to influence the result.</p>
                  
                  {images.length < MAX_IMAGES && (
                    <div 
                        className={`w-full p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${isDraggingOver ? 'border-purple-400 bg-purple-500/10' : 'border-gray-600'}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                        onDragLeave={() => setIsDraggingOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(false);
                          handleFileSelect(e.dataTransfer.files);
                        }}
                    >
                      <UploadIcon className="w-8 h-8 text-gray-500" />
                      <label htmlFor="image-upload-generate" className="text-purple-400 font-semibold cursor-pointer hover:underline">
                        Upload a file
                        <input id="image-upload-generate" type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleFileSelect(e.target.files)} />
                      </label>
                      <span className="text-gray-500 text-sm">or drag and drop</span>
                    </div>
                  )}

                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {imagePreviews.map((previewUrl, index) => (
                        <div key={index} className="relative group">
                           <img src={previewUrl} alt={`preview ${index}`} className="w-24 h-24 object-cover rounded-md" />
                           <button 
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove image"
                           >
                              <XIcon className="w-4 h-4" />
                           </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-3">
                    <span className="text-md font-medium text-gray-400">Aspect Ratio:</span>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {aspectRatios.map(({ name, value }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setActiveAspect(value)}
                                disabled={isLoading}
                                className={`px-4 py-2 rounded-md text-base font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                                    activeAspect === value
                                    ? 'bg-gradient-to-br from-purple-600 to-indigo-500 text-white shadow-md shadow-purple-500/20'
                                    : 'bg-white/10 hover:bg-white/20 text-gray-200'
                                }`}
                                aria-pressed={activeAspect === value}
                            >
                                {name} ({value})
                            </button>
                        ))}
                    </div>
                </div>

                <button 
                    type="submit"
                    className="w-full max-w-sm bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none mt-4"
                    disabled={isLoading || !prompt.trim()}
                >
                    Generate Image
                </button>
            </form>
        )}
    </div>
  );
};

export default GenerateScreen;