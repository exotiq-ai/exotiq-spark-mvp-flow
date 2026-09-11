import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const ReelCaption: React.FC<{
  text: string;
  duration: number;
  fontFamily: string;
  aspect: "vertical" | "feed";
}> = ({ text, duration, fontFamily, aspect }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const y = interpolate(rise, [0, 1], [22, 0]);
  const out = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bottom = aspect === "feed" ? 92 : 112;
  const fontSize = aspect === "feed" ? 28 : 30;
  const maxWidth = aspect === "feed" ? 900 : 940;
  const padding = aspect === "feed" ? "14px 28px" : "16px 32px";

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: bottom,
      }}
    >
      <div
        style={{
          transform: `translateY(${y}px)`,
          opacity: Math.min(rise, out),
          background: "rgba(6,8,12,0.82)",
          border: `1px solid ${COLORS.line}`,
          borderRadius: 999,
          padding,
          fontFamily,
          fontSize,
          letterSpacing: -0.3,
          color: COLORS.text,
          textAlign: "center",
          maxWidth,
          lineHeight: 1.35,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
