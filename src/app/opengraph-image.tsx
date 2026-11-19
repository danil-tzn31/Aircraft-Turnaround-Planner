import { ImageResponse } from "next/og";

export const alt = "Aircraft Turnaround Planner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same colours as the theme in globals.css.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "#1c1f23",
          color: "#f2f3f4",
          borderLeft: "24px solid #ffd200",
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05, display: "flex" }}>
          Aircraft Turnaround Planner
        </div>
        <div style={{ marginTop: 32, fontSize: 38, color: "#c9ccd1", lineHeight: 1.3, display: "flex" }}>
          See how delays move an aircraft&apos;s departure, using critical path scheduling.
        </div>
      </div>
    ),
    { ...size },
  );
}
