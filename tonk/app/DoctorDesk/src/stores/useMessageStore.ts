import { create } from "zustand";
import { sync } from "@tonk/keepsync";

// Roles
export type Role = "doctor" | "patient" | "lab";

// Patient info (optional)
export interface PatientInfo {
  name: string;
  age: number;
  sex: "male" | "female" | "other";
}

// Message
export interface Message {
  id: string;
  from: Role;
  to: Role;
  text?: string;
  imageDataUrl?: string;
  timestamp: string;
}

// Store shape
interface MessageStore {
  patientInfo?: PatientInfo;
  messages: Message[];
  setPatientInfo: (info: PatientInfo) => void;
  sendMessage: (msg: {
    from: Role;
    to: Role;
    text?: string;
    imageDataUrl?: string;
  }) => void;
}

export const useMessageStore = create<MessageStore>()(
  sync(
    (set, get) => ({
      patientInfo: undefined,
      messages: [],

      setPatientInfo: (info) => {
        set({ patientInfo: info });
      },

      sendMessage: ({ from, to, text, imageDataUrl }) => {      
        // Skip sending if both are empty
        if (!text && !imageDataUrl) {
          console.warn("⚠️ Skipping empty message (no text or image)");
          return;
        }
      
        const newMsg: Message = {
          id: crypto.randomUUID(),
          from,
          to,
          ...(text ? { text } : {}),
          ...(imageDataUrl ? { imageDataUrl } : {}),
          timestamp: new Date().toISOString(),
        };
      
        set((state) => {
          const updatedMessages = [...state.messages, newMsg];
          return { messages: updatedMessages };
        });
      },
    }),
    {
      docId: "shared-medical-messages-v1",
    }
  )
);