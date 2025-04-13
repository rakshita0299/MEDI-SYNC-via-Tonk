import React, { useState, useRef } from "react";
import { useMessageStore, Role, Message } from "./stores/useMessageStore";

const FROM: Role = "doctor";
const TABS: Role[] = ["patient", "lab"];

const MessageList = ({
  messages,
  role,
  activeTo,
}: {
  messages: Message[];
  role: Role;
  activeTo: Role;
}) => {
  const [aiInsights, setAiInsights] = useState<Record<string, React.ReactNode>>({});

  const fetchInsight = async (type: string, msg: Message) => {
    let endpoint = "";
    let body: any = {};

    if (type === "vital") {
      endpoint = "/analyze-vitals";
      body = msg.text;
    } else if (type === "mri" || type === "segment") {
      endpoint = type === "mri" ? "/analyze-image" : "/segment-image";
      body = { image_data: msg.imageDataUrl };
    }

    try {
      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      let output: React.ReactNode = "";

      if (type === "vital" && Array.isArray(data.insights)) {
        output = (
          <ul className="mt-2 text-green-700 text-sm space-y-2">
            {data.insights.map((point: string, index: number) => (
              <li key={index}>• {point}</li>
            ))}
          </ul>
        );
      } else if (type === "mri") {
        const label = data.prediction;
        const sentence =
          label === "benign"
            ? "🧠 The scan shows no signs of a harmful tumor. Everything looks okay, stay healthy! 😊"
            : label === "malignant"
            ? "⚠️ The scan indicates signs of a malignant tumor. Please consult your doctor immediately for further evaluation. 🩺"
            : `❓ Unable to determine the tumor type. Please try again or consult a specialist.: ${label}`;
        output = <div className="mt-2 text-green-700 text-sm">{sentence}</div>;
      } else if (type === "segment" && data.prediction?.startsWith("data:image")) {
        output = (
          <img
            src={data.prediction}
            alt="Segmentation Output"
            className="mt-2 rounded border w-full max-w-md"
          />
        );
      }

      setAiInsights((prev) => ({ ...prev, [msg.id]: output }));
    } catch (err) {
      setAiInsights((prev) => ({ ...prev, [msg.id]: <div className="text-red-500">⚠️ Analysis failed.</div> }));
    }
  };

  return (
    <ul className="space-y-2 flex flex-col">
      {messages
        .filter(
          (msg) =>
            (msg.from === role && msg.to === activeTo) ||
            (msg.from === activeTo && msg.to === role)
        )
        .map((msg) => {
          const isOwn = msg.from === role;
          const senderName = msg.from.charAt(0).toUpperCase() + msg.from.slice(1);
          const textLower = typeof msg.text === "string" ? msg.text.toLowerCase() : "";

          const triggerVitals = /vital|bp|blood pressure|sugar|glucose|pulse|heart rate/.test(textLower);
          const triggerMRI = /mri|brain scan|tumor|brain image|ct scan|neuro image/.test(textLower);
          const triggerSegment = /segment|mark region|highlight lesion|annotate image|outline damage|visualize area/.test(textLower);

          return (
            <li
              key={msg.id}
              className={`p-3 rounded text-sm max-w-xs ${
                isOwn
                  ? "bg-gray-800 text-white self-end ml-auto"
                  : "bg-gray-200 text-black self-start"
              }`}
              style={{ display: "flex", flexDirection: "column" }}
            >
              <div className="text-xs text-gray-500 mb-1">
                <span className="mr-20">{senderName}</span>{" "}
                {new Date(msg.timestamp).toLocaleString()}
              </div>
              {typeof msg.text === "string" && <div className="mt-1 whitespace-pre-wrap">{msg.text}</div>}
              {msg.imageDataUrl && (
                <img
                  src={msg.imageDataUrl}
                  alt="sent"
                  className="mt-2 rounded border max-w-xs"
                />
              )}
              {!isOwn && !aiInsights[msg.id] && (
                <>
                  {triggerVitals && (
                    <button
                      className="text-xs text-blue-600 underline mt-2 text-left"
                      onClick={() => fetchInsight("vital", msg)}
                    >
                      🔍 Analyze Vitals
                    </button>
                  )}
                  {triggerMRI && msg.imageDataUrl && (
                    <button
                      className="text-xs text-blue-600 underline mt-2 text-left"
                      onClick={() => fetchInsight("mri", msg)}
                    >
                      🧠 Run MRI Detector
                    </button>
                  )}
                  {triggerSegment && msg.imageDataUrl && (
                    <button
                      className="text-xs text-blue-600 underline mt-2 text-left"
                      onClick={() => fetchInsight("segment", msg)}
                    >
                      🖼️ Segment Region
                    </button>
                  )}
                </>
              )}
              {aiInsights[msg.id] && <div className="mt-2">{aiInsights[msg.id]}</div>}
            </li>
          );
        })}
    </ul>
  );
};

export default function App() {
  const messages = useMessageStore((s) => s.messages);
  const sendMessage = useMessageStore((s) => s.sendMessage);

  const [activeTo, setActiveTo] = useState<Role>("patient");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSend = () => {
    if (!text.trim() && !imageFile) return;

    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        sendMessage({
          from: FROM,
          to: activeTo,
          text: text.trim() || undefined,
          imageDataUrl: reader.result as string,
        });
        setText("");
        setImageFile(null);
        if (inputRef.current) inputRef.current.value = "";
      };
      reader.readAsDataURL(imageFile);
    } else {
      sendMessage({
        from: FROM,
        to: activeTo,
        text: text.trim(),
      });
      setText("");
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">🩺 Doctor Desk</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-1 rounded border ${
              activeTo === tab
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-black border-gray-300"
            }`}
            onClick={() => {
              setActiveTo(tab);
              setText("");
              setImageFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            {tab === "patient" ? "Patient" : "Lab"}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div>
        <textarea
          className="w-full border p-2 mb-2"
          rows={3}
          placeholder={`Write message to ${activeTo}...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          className="mb-2"
          ref={inputRef}
          onChange={(e) => {
            if (e.target.files?.[0]) setImageFile(e.target.files[0]);
          }}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={handleSend}
        >
          Send to {activeTo.charAt(0).toUpperCase() + activeTo.slice(1)}
        </button>
      </div>

      {/* Messages */}
      <h2 className="text-lg font-semibold">📨 Messages with {activeTo}</h2>
      <MessageList messages={messages} role={FROM} activeTo={activeTo} />
    </div>
  );
}