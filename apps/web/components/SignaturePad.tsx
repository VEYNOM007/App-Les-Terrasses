'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PenLine, RotateCcw, X } from 'lucide-react';

interface SignaturePadProps {
  onConfirm: (signature: Blob) => void;
  onCancel: () => void;
}

/**
 * Zone de signature manuscrite (canvas) : dessin souris/tactile, export en
 * PNG (Blob) pour l'endpoint POST /contracts/:id/sign.
 */
export default function SignaturePad({ onConfirm, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1c1917';
  }, []);

  const getPosition = (event: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: React.PointerEvent) => {
    event.preventDefault();
    drawingRef.current = true;
    const context = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPosition(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (event: React.PointerEvent) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const context = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPosition(event);
    context.lineTo(x, y);
    context.stroke();
    setHasInk(true);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, 'image/png');
  };

  return (
    <div className="bg-ink-card border border-paper/20 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-paper/60 uppercase flex items-center gap-2">
          <PenLine className="w-4 h-4 text-laterite-light" />
          Signez dans le cadre
        </span>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 font-mono text-xs text-paper/60 hover:text-paper transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Effacer
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        className="w-full h-40 bg-paper touch-none rounded border border-paper/30 cursor-crosshair"
      />

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 font-mono text-xs text-paper/60 hover:text-paper px-4 py-2 rounded transition-colors"
        >
          <X className="w-4 h-4" /> Annuler
        </button>
        <button
          type="button"
          disabled={!hasInk}
          onClick={confirm}
          className="bg-laterite hover:bg-laterite-light disabled:opacity-40 disabled:cursor-not-allowed text-paper font-mono text-xs px-6 py-2 rounded transition-all font-semibold"
        >
          Valider la signature →
        </button>
      </div>
    </div>
  );
}
