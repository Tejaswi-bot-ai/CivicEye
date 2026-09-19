<div align="center">

# 🚍 CivicEye

### AI-Powered Mobile Urban Intelligence Platform

**Turning public transport buses into mobile urban intelligence units.**

</div>

---

## 🏆 Smart India Hackathon 2026

|                       |                                   |
| --------------------- | --------------------------------- |
| **Problem Statement** | PS 26124                          |
| **Team Name**         | Innovexal                         |
| **Project**           | CivicEye                          |
| **Domain**            | Smart Cities / Urban Intelligence |

---

## 💡 About CivicEye

**CivicEye** is an AI-powered urban intelligence platform that uses cameras mounted on public transport vehicles to identify road conditions and urban incidents while the vehicle is moving.

Instead of depending only on manual inspections or citizen complaints, CivicEye enables buses to act as **mobile road-monitoring units**.

The detected information can be processed, localized and presented through a centralized dashboard for monitoring and municipal action.

---

## 🎯 Problem

Urban road conditions can change continuously.

Common challenges include:

* 🕳️ Potholes and damaged roads
* 💧 Waterlogging
* 🚨 Road accidents
* 🚦 Traffic congestion
* 📍 Difficulty identifying the exact incident location
* ⏳ Delayed reporting and response
* 🔁 Duplicate complaints for the same road issue

Traditional monitoring methods can require significant manual effort and may not provide continuous road-level coverage.

---

## 🚀 Our Solution

CivicEye creates a pipeline that connects:

**Bus Camera → AI Detection → Incident Processing → Location → Dashboard → Municipal Action**

### System Flow

```text
🚌 Public Transport Bus
          ↓
      📷 Camera
          ↓
    🎥 Video Stream
          ↓
    🤖 AI Detection
          ↓
   Incident Processing
          ↓
   📍 GPS + Timestamp
          ↓
     🗄️ Backend
          ↓
   🗺️ CivicEye Dashboard
          ↓
  📢 Municipal Notification
```

---

## ✨ Key Features

### 🕳️ Pothole & Road Hazard Detection

CivicEye analyzes road footage to identify road hazards such as potholes and waterlogged areas.

### 💧 Waterlogging Detection

Waterlogged road conditions can be identified from captured video and recorded as incidents.

### 🚨 Accident Monitoring

The platform supports detection and handling of critical accident events.

### 🚦 Traffic Monitoring

Traffic conditions can be analyzed and represented through the urban intelligence dashboard.

### 📍 Location-Based Incidents

Incident records can contain contextual information such as:

* Location
* Timestamp
* Bus ID
* Ward / Area
* Detection type

### 📸 Visual Evidence

Detection snapshots can be associated with incidents to help authorities verify reported conditions.

### 🔔 Intelligent Notification

CivicEye separates **detected/triggered incidents** from incidents that are actually passed to municipal authorities.

This helps reduce unnecessary and repeated notifications.

### 🔊 Driver Voice Alerts

Critical hazards can generate voice warnings for the driver, providing an additional safety mechanism.

---

## 🧠 AI & Computer Vision Pipeline

```text
Video Input
     ↓
Frame Processing
     ↓
Computer Vision
     ↓
YOLO Detection
     ↓
Hazard Classification
     ↓
Severity Evaluation
     ↓
Duplicate / Spatial Filtering
     ↓
Incident Record
```

The AI pipeline is designed to transform raw video into structured urban intelligence.

---

## 🏗️ Architecture

```text
┌─────────────────────┐
│   Public Transport  │
│        Bus          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      Camera         │
│   Video Capture     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    AI Detection     │
│    YOLO + OpenCV    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Incident Processing │
│ Severity + Filtering│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│       Backend       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  CivicEye Dashboard │
│  Urban Monitoring   │
└─────────────────────┘
```

---

## 🛠️ Technology Stack

| Component               | Technology   |
| ----------------------- | ------------ |
| Frontend                | React        |
| Language                | TypeScript   |
| Backend                 | Node.js      |
| Development             | Vite / TSX   |
| Computer Vision         | OpenCV       |
| AI Detection            | YOLO         |
| Database / Local Cache  | SQLite       |
| Real-Time Communication | WebSocket    |
| Version Control         | Git / GitHub |

---

## 📊 Incident Management

CivicEye uses two important stages for incident handling:

### 1. Triggered

AI-detected events that enter the incident processing workflow.

### 2. Messages Passed

Events that satisfy configured conditions and are passed onward for municipal action.

This separation helps prevent every individual detection from becoming a separate municipal complaint.

---

## 🔊 Voice Alert Workflow

For major or critical hazards:

```text
Hazard Detected
      ↓
Severity Evaluation
      ↓
Critical / Major?
      ↓
     YES
      ↓
Driver Voice Warning
      ↓
   VOICE SENT
```

Voice alerts can provide an early warning to the driver when a significant road hazard is identified.

---

## 📁 Project Structure

```text
CivicEye/
│
├── src/
├── assets/
├── server.ts
├── package.json
├── README.md
├── vite.config.*
└── ...
```

> The project structure may evolve as development continues.

---

## ⚙️ Running the Project

### Prerequisites

* Node.js
* npm
* Git

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the project

```bash
cd CivicEye
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

Open the local address displayed by the development server.

---

## 📸 Screenshots

### CivicEye Dashboard

*Add dashboard screenshot here.*

### AI Detection

*Add AI detection screenshot here.*

### Triggered Incidents

*Add triggered incident screenshot here.*

### Messages Passed

*Add municipal notification screenshot here.*

### Voice Alert History

*Add voice alert screenshot here.*

---

## 🔗 GitHub Repository

**Source Code:**
YOUR_GITHUB_REPOSITORY_URL

---

## 🔮 Future Scope

* 🚌 Multi-bus fleet integration
* 🤖 Improved AI detection accuracy
* 🗺️ Advanced GIS analytics
* 🏛️ Automated department-wise routing
* 📊 Predictive road-maintenance analysis
* ☁️ Cloud-based fleet management
* 📡 Better operation under low-connectivity conditions
* 🚨 Expanded emergency-service integration

---

## 👥 Team

### Innovexal

**Smart India Hackathon 2026**

> Building technology for safer, smarter and more responsive cities.
