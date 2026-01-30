import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Loader2, Download, Image as ImageIcon, Wand2, ShieldCheck } from 'lucide-react';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [highQuality, setHighQuality] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);

    try {
      if (highQuality) {
        // Fix: Added safe navigation for optional window.aistudio property
        const hasKey = await window.aistudio?.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio?.openSelectKey();
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = highQuality ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize: highQuality ? "1K" : undefined
          }
        },
      });

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            setGeneratedImages(prev => [imageUrl, ...prev]);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        setError("Could not generate image. The prompt might have been blocked or the model didn't return visual data.");
      }

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setError("API Key issue detected. Please re-select your professional API key.");
        // Fix: Added safe navigation for optional window.aistudio property
        await window.aistudio?.openSelectKey();
      } else {
        setError("An error occurred during generation. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImprovePrompt = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as a professional prompt engineer. Improve this image generation prompt to be more descriptive and artistic: "${prompt}"`,
      });
      if (response.text) {
        setPrompt(response.text.trim());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Creative Assets</h1>
          <p className="text-slate-500">Generate unique visuals for corporate blogs, headers, and team posters.</p>
        </div>
        <div className="hidden md:flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-xl text-indigo-600 text-sm font-bold">
          <ShieldCheck size={18} />
          <span>Powered by Gemini 2.5/3</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Prompt Description</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A sleek, modern office lobby..."
                className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm"
              />
              <button 
                onClick={handleImprovePrompt}
                disabled={isGenerating || !prompt}
                className="mt-2 flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <Wand2 size={14} />
                <span>Improve with AI</span>
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">Settings</label>
              <div className="grid grid-cols-2 gap-2">
                {(['1:1', '16:9', '9:16', '4:3'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      aspectRatio === ratio 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${highQuality ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">High Quality</div>
                    <div className="text-[10px] text-slate-500">Gemini 3 Pro (1K)</div>
                  </div>
                </div>
                <button 
                  onClick={() => setHighQuality(!highQuality)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${highQuality ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${highQuality ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center space-x-3"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <ImageIcon size={20} />
                  <span>Generate Asset</span>
                </>
              )}
            </button>
            {error && <p className="text-xs text-red-500 font-medium text-center">{error}</p>}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {generatedImages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedImages.map((img, idx) => (
                <div key={idx} className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg transition-all animate-in zoom-in-95 duration-500">
                  <img src={img} alt={`Generated ${idx}`} className="w-full h-auto object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a 
                      href={img} 
                      download={`attendify-asset-${idx}.png`}
                      className="p-3 bg-white rounded-full text-indigo-600 hover:scale-110 transition-transform shadow-xl"
                    >
                      <Download size={24} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 h-[500px] flex flex-col items-center justify-center text-slate-400 p-12 text-center">
              <ImageIcon size={40} className="opacity-20 mb-6" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No assets generated yet</h3>
              <p className="max-w-sm">Enter a prompt on the left to create professional imagery.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;
