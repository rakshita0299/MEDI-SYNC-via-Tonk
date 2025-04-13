import React, { useState, useRef } from "react";
import { useMessageStore, Role, Message } from "./stores/useMessageStore";

const FROM: Role = "patient";
const TO: Role = "doctor";

export default function App() {
  const messages = useMessageStore((s) => s.messages);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const patientInfo = useMessageStore((s) => s.patientInfo);
  const setPatientInfo = useMessageStore((s) => s.setPatientInfo);

  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", age: "", sex: "male" });
  const [aiInsights, setAiInsights] = useState<Record<string, React.ReactNode>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmitProfile = () => {
    if (!form.name || !form.age) return;
    setPatientInfo({
      name: form.name,
      age: parseInt(form.age),
      sex: form.sex as "male" | "female" | "other",
    });
  };

  const handleSend = () => {
    if (!text.trim() && !imageFile) return;

    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        sendMessage({
          from: FROM,
          to: TO,
          text: text.trim() || undefined,
          imageDataUrl: reader.result as string,
        });
        setText("");
        setImageFile(null);
        if (inputRef.current) inputRef.current.value = "";
      };
      reader.readAsDataURL(imageFile);
    } else {
      sendMessage({ from: FROM, to: TO, text: text.trim() });
      setText("");
    }
  };

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
            : `❓ Unable to determine tumor type: ${label}`;
      
        const colorClass =
          label === "benign"
            ? "text-green-700"
            : label === "malignant"
            ? "text-red-600"
            : "text-gray-600";
      
        output = <div className={`mt-2 text-sm ${colorClass}`}>{sentence}</div>;
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
      setAiInsights((prev) => ({
        ...prev,
        [msg.id]: <div className="text-red-500">⚠️ Analysis failed.</div>,
      }));
    }
  };

  const MessageList = ({ messages }: { messages: Message[] }) => (
    <ul className="space-y-2 flex flex-col">
      {messages
        .filter((msg) => msg.from === FROM || msg.to === FROM)
        .map((msg) => {
          const isOwn = msg.from === FROM;
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
              {typeof msg.text === "string" && (
                <div className="mt-1 whitespace-pre-wrap">{msg.text}</div>
              )}
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

  if (!patientInfo) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">🩺 Enter Patient Info</h1>
        <input
          className="w-full border p-2 mb-2"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full border p-2 mb-2"
          placeholder="Age"
          type="number"
          value={form.age}
          onChange={(e) => setForm({ ...form, age: e.target.value })}
        />
        <select
          className="w-full border p-2 mb-4"
          value={form.sex}
          onChange={(e) => setForm({ ...form, sex: e.target.value })}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <button
          onClick={handleSubmitProfile}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save & Continue
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">
        👋 Welcome, {patientInfo.name} ({patientInfo.age}, {patientInfo.sex})
      </h1>

      <textarea
        className="w-full border p-2 mb-2"
        rows={3}
        placeholder="Write a message to your doctor..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <input
        type="file"
        accept="image/*"
        ref={inputRef}
        className="mb-2"
        onChange={(e) => {
          if (e.target.files?.[0]) setImageFile(e.target.files[0]);
        }}
      />

      <button
        onClick={handleSend}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Send to Doctor
      </button>

      <h2 className="text-lg font-semibold">📨 Messages</h2>
      <MessageList messages={messages} />
    </div>
  );
}