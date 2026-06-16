import { ImageResponse } from "next/og";

// Static OG/Twitter share image (1200x630). Uses the brand tokens.
export const runtime = "edge";
export const alt = "Savings Planner — วางแผนเก็บเงิน";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#1B2A4A",
          color: "#F5F6F8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 96,
              background: "#D8A24A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1B2A4A",
              fontSize: 56,
              fontWeight: 700,
            }}
          >
            ฿
          </div>
          <div style={{ fontSize: 40, color: "#D8A24A", fontWeight: 600 }}>
            Savings Planner
          </div>
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            display: "flex",
          }}
        >
          ตั้งเป้า แล้วเก็บเงินให้ถึงฝัน
        </div>
        <div style={{ marginTop: 24, fontSize: 34, color: "#9aa3b2", display: "flex" }}>
          วางแผนและติดตามการเก็บเงินตามเป้าหมายของคุณ
        </div>
      </div>
    ),
    { ...size },
  );
}
