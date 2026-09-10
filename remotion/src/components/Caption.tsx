import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const Caption: React.FC<{ text: string; duration: number; fontFamily: string }> = ({
  text,
  duration,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const y = interpolate(rise, [0, 1], [26, 0]);
  const out = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 68 }}>
      <div
        style={{
          transform: `translateY(${y}px)`,
          opacity: Math.min(rise, out),
          background: "rgba(6,8,12,0.78)",
          border: `1px solid ${COLORS.line}`,
          borderRadius: 999,
          padding: "16px 34px",
          fontFamily,
          fontSize: 34,
          letterSpacing: -0.4,
          color: COLORS.text,
          textAlign: "center",
          maxWidth: 1420,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
