import { create } from "zustand";
import { sync } from "@tonk/keepsync";

// Roles
type Role = "doctor" | "patient";

// Patient Info
export interface PatientInfo {
  name: string;
  age: number;
  sex: "male" | "female" | "other";
}

// Message Type
export interface Message {
  id: string;
  from: Role;
  to: Role;
  text?: string;
  imageDataUrl?: string;
  timestamp: string;
}

// Zustand Store Shape
interface MessageStore {
  patientInfo: PatientInfo | null;
  messages: Message[];
  setPatientInfo: (info: PatientInfo | null) => void;
  sendMessage: (msg: {
    from: Role;
    to: Role;
    text?: string;
    imageDataUrl?: string;
  }) => void;
}

// Create Shared Zustand Store
export const useMessageStore = create<MessageStore>()(
  sync(
    (set, get) => ({
      patientInfo: null,
      messages: [],

      setPatientInfo: (info) => {
        set({ patientInfo: info });
      },

      sendMessage: ({ from, to, text, imageDataUrl }) => {
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

        set((state) => ({
          messages: [...state.messages, newMsg],
        }));
      },
    }),
    {
      docId: "shared-medical-messages-v1",
    }
  )
);