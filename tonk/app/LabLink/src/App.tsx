import React, { useState, useRef } from "react";
import { useMessageStore, Role, Message } from "./stores/useMessageStore";

const FROM: Role = "lab";
const TO: Role = "doctor";

const MessageList = ({ messages }: { messages: Message[] }) => (
  <ul className="space-y-2 flex flex-col">
    {messages
      .filter((msg) => msg.from === FROM || msg.to === FROM)
      .map((msg) => {
        const isOwn = msg.from === FROM;
        const senderName =
          msg.from.charAt(0).toUpperCase() + msg.from.slice(1);
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
              <div className="mt-1">{msg.text}</div>
            )}
            {msg.imageDataUrl && (
              <img
                src={msg.imageDataUrl}
                alt="sent"
                className="mt-2 rounded border max-w-xs"
              />
            )}
          </li>
        );
      })}
  </ul>
);

export default function App() {
  const messages = useMessageStore((s) => s.messages);
  const sendMessage = useMessageStore((s) => s.sendMessage);
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

  return (
    <div className="p-6 max-w-xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">🧪 LabLink</h1>

      <textarea
        className="w-full border p-2 mb-2"
        rows={3}
        value={text}
        placeholder="Send test results to doctor..."
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
        className="bg-purple-600 text-white px-4 py-2 rounded"
        onClick={handleSend}
      >
        Send to Doctor
      </button>

      <h2 className="text-lg font-semibold">📨 Messages</h2>
      <MessageList messages={messages} />
    </div>
  );
}