import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const ReelCTAText: React.FC<{
  keyword: string;
  fontFamily: string;
  aspect: "vertical" | "feed";
  from: number;
}> = ({ keyword, fontFamily, aspect, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - from,
    fps,
    config: { damping: 22, stiffness: 120 },
    durationInFrames: 22,
  });
  const scale = interpolate(s, [0, 1], [0.9, 1]);
  const opacity = interpolate(s, [0, 1], [0, 1]);

  const bottom = aspect === "feed" ? 190 : 230;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: bottom,
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          fontFamily,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 1.2,
          color: COLORS.bgDeep,
          textTransform: "uppercase",
          textAlign: "center",
          background: COLORS.accent,
          borderRadius: 999,
          padding: "14px 30px",
          boxShadow: "0 16px 40px rgba(59,130,246,0.35)",
        }}
      >
        Comment {keyword}
      </div>
    </AbsoluteFill>
  );
};
