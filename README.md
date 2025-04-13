# 🧠 MediSync: Decentralized Healthcare with Tonk + AI

A privacy-first, real-time medical collaboration platform built with the **Tonk stack**, featuring **three interoperable mini-apps** — PatientConnect, DoctorDesk, and LabLink — that **share data seamlessly** using a single local-first datastore and integrate **AI-powered medical analysis**.

---

## 🚀 Overview

MediSync enables patients, doctors, and labs to communicate, collaborate, and analyze medical data in one shared ecosystem — without relying on centralized databases or authentication.

Built using [Tonk](https://tonk.dev), this system leverages:

- **Local-first sync (via Automerge)**
- **Shared state across apps**
- **AI assistance for vital analysis, tumor detection, and segmentation**
- **Ephemeral, privacy-friendly architecture**
- **Beautiful, chat-style UX**

---

## 🧩 Mini-Apps

### 🧍 PatientConnect
- Share personal health data and vitals
- Upload images (e.g., scans) and send to doctor
- View doctor and lab responses in real-time

### 🩺 DoctorDesk
- View patient and lab messages
- Request lab reports or medical images
- Use AI to analyze vitals, MRI images, and segment anomalies

### 🧪 LabLink
- Receive image or test requests from doctor
- Upload medical reports or diagnostic images
- Communicate directly with doctors

---

## 💡 AI Features

Integrated with Flask-based APIs for instant feedback:

| Feature         | Triggered By Keyword | Output                          |
|----------------|----------------------|----------------------------------|
| 🔍 Vitals Analysis | `vital`, `bp`, `sugar` etc. | 5–6 health insights in bullets |
| 🧠 MRI Detection   | `mri`, `tumor`, `ct scan`   | Benign or malignant result     |
| 🖼️ Image Segmentation | `segment`, `highlight`, `lesion` | Visual mask of affected area   |

---

## 🔒 Why Tonk?

- **Local-first architecture**: Data stays on the user's device
- **No server required**: Everything works offline and syncs when online
- **Shared datastore**: All apps use the same Automerge doc
- **Instant interoperability**: Real-time sync with no backend logic

---

## ⚙️ Tech Stack

- 🧠 **Tonk** + **Automerge**
- 💬 **Zustand** for state management
- 🌐 **React + TypeScript**
- 🧪 **Flask** APIs for AI inference
- 🧠 **HuggingFace Transformers** + PyTorch
- 🖼️ **Custom UNet Model** for image segmentation

---

## 📦 Getting Started

```bash
# 1. Clone this repo
git clone https://github.com/yourusername/medisync-tonk.git

# 2. Install dependencies
pnpm install

# 3. Start the Tonk sync server (in another terminal)
pnpm tonk serve

# 4. Run each mini-app
pnpm dev:patient
pnpm dev:doctor
pnpm dev:lab

# 5. Start Flask backend for AI
cd backend
python app.py
