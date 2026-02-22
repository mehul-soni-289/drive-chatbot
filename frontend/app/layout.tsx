import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drive Chatbot — AI-Powered Google Drive Assistant",
  description:
    "Chat with your Google Drive files using natural language. Powered by Gemini 2.5 Pro and the Model Context Protocol.",
  keywords: ["Google Drive", "AI chatbot", "MCP", "Gemini", "document search"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
