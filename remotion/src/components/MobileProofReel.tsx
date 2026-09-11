import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { COLORS } from "../theme";

const sora = loadSora("normal", { weights: ["600", "700"], subsets: ["latin"] });
const manrope = loadManrope("normal", { weights: ["500", "700"], subsets: ["latin"] });

const lines = [
  { from: 0, duration: 78, file: "line-1.mp3", caption: "Car down Friday. Saturday booking blocked." },
  { from: 78, duration: 102, file: "line-2.mp3", caption: "Exotiq stops the apology call before it starts." },
  { from: 180, duration: 75, file: "line-3.mp3", caption: "I’m Rari, Exotiq’s AI fleet manager." },
  { from: 255, duration: 150, file: "line-4.mp3", caption: "Mark it Out of Service once. I carry that status into fleet and booking." },
  { from: 405, duration: 115, file: "line-5.mp3", caption: "One answer for your team. That car can’t be selected for those dates." },
  { from: 520, duration: 80, file: "line-6.mp3", caption: "No double-booking. No comped weekend." },
  { from: 600, duration: 75, file: "line-7.mp3", caption: "Comment TRUTH for the walkthrough." },
] as const;

const shots = [
  { from: 0, duration: 54, file: "01-maintenance-list.png" },
  { from: 54, duration: 126, file: "02-oos-detail.png" },
  { from: 180, duration: 75, file: "01-maintenance-list.png" },
  { from: 255, duration: 150, file: "02-oos-detail.png" },
  { from: 405, duration: 55, file: "05-booking-ready.png" },
  { from: 460, duration: 140, file: "06-booking-blocked.png" },
] as const;

const Caption: React.FC<{ text: string; duration: number }> = ({ text, duration }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 5, duration - 5, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ position: "absolute", left: 54, right: 54, bottom: 170, display: "flex", justifyContent: "center", opacity }}>
      <div style={{ maxWidth: 930, padding: "18px 28px", borderRadius: 18, background: "rgba(4,5,7,.88)", border: "1px solid rgba(255,255,255,.18)", color: "white", textAlign: "center", fontFamily: manrope.fontFamily, fontWeight: 700, fontSize: 42, lineHeight: 1.16, boxShadow: "0 18px 50px rgba(0,0,0,.45)" }}>
        {text}
      </div>
    </div>
  );
};

const ProofShot: React.FC<{ file: string; duration: number }> = ({ file, duration }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 5, duration - 5, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Img src={staticFile(`shots/${file}`)} style={{ width: "100%", height: "100%", objectFit: "contain", opacity }} />;
};

export const MOBILE_PROOF_REEL_FRAMES = 750;

export const MobileProofReel: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {shots.map((shot) => (
        <Sequence key={`${shot.from}-${shot.file}`} from={shot.from} durationInFrames={shot.duration}>
          <ProofShot file={shot.file} duration={shot.duration} />
        </Sequence>
      ))}

      {frame < 78 && (
        <div style={{ position: "absolute", top: 118, left: 46, right: 46, padding: "20px 24px", borderRadius: 18, background: "rgba(4,5,7,.92)", borderLeft: "8px solid #F04444", color: "white", fontFamily: sora.fontFamily, fontWeight: 700, fontSize: 50, lineHeight: 1.05, textAlign: "center", letterSpacing: -1 }}>
          CAR DOWN FRIDAY.<br /><span style={{ color: "#FFBA43" }}>SATURDAY BOOKING BLOCKED.</span>
        </div>
      )}

      {lines.map((line) => (
        <Sequence key={line.file} from={line.from} durationInFrames={line.duration}>
          <Audio src={staticFile(`audio/reel1-mobile/${line.file}`)} />
          <Caption text={line.caption} duration={line.duration} />
        </Sequence>
      ))}

      {frame >= 520 && frame < 600 && (
        <div style={{ position: "absolute", top: 140, left: 45, right: 45, color: "white", fontFamily: sora.fontFamily, textAlign: "center", fontSize: 61, fontWeight: 700, lineHeight: 1.05, textShadow: "0 4px 24px #000" }}>
          ONE FLEET.<br /><span style={{ color: "#4C8DFF" }}>ONE TRUTH.</span>
        </div>
      )}

      {frame >= 675 && (
        <AbsoluteFill style={{ background: "linear-gradient(145deg,#07080B,#111A2A)", alignItems: "center", justifyContent: "center", fontFamily: sora.fontFamily, color: "white" }}>
          <div style={{ fontSize: 38, color: "#8DB6FF", marginBottom: 24, letterSpacing: 5 }}>EXOTIQ</div>
          <div style={{ fontSize: 68, fontWeight: 700, marginBottom: 22 }}>@exotiq_ai</div>
          <div style={{ fontFamily: manrope.fontFamily, fontSize: 34, color: "rgba(255,255,255,.7)" }}>exotiq.ai</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};