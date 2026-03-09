import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignatureCanvasRef {
  toDataURL: () => string | null;
  isEmpty: () => boolean;
}

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  onSignatureChange?: (hasSignature: boolean) => void;
}

export const SignatureCanvas = forwardRef<SignatureCanvasRef, SignatureCanvasProps>(
  ({ width = 500, height = 200, className, onSignatureChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      toDataURL: () => {
        if (!hasSignature || !canvasRef.current) return null;
        return canvasRef.current.toDataURL("image/png");
      },
      isEmpty: () => !hasSignature,
    }));

    const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      const point = getCanvasPoint(e);
      lastPoint.current = point;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }, [getCanvasPoint]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || !lastPoint.current) return;

      const point = getCanvasPoint(e);
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPoint.current = point;

      if (!hasSignature) {
        setHasSignature(true);
        onSignatureChange?.(true);
      }
    }, [isDrawing, getCanvasPoint, hasSignature, onSignatureChange]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDrawing(false);
      lastPoint.current = null;
    }, []);

    const clearCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onSignatureChange?.(false);
    }, [onSignatureChange]);

    // Initialize canvas context
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = "hsl(var(--foreground))";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = "hsl(var(--foreground))";
    }, []);

    return (
      <div className={className}>
        <div
          className={`relative rounded-lg border-2 transition-colors ${
            hasSignature
              ? "border-primary bg-background"
              : "border-dashed border-muted-foreground/30 bg-muted/20"
          }`}
        >
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full cursor-crosshair touch-none"
            style={{ aspectRatio: `${width}/${height}` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-muted-foreground">Sign here</p>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearCanvas}
            disabled={!hasSignature}
            className="text-xs"
          >
            <Eraser className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>
        </div>
      </div>
    );
  }
);

SignatureCanvas.displayName = "SignatureCanvas";
