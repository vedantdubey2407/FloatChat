# 🌊 FloatChat

> An AI-powered marine intelligence & conversational platform built with Next.js, FastAPI, Three.js, and OpenRouter API.

---

## ✨ Overview

FloatChat is a full-stack AI chat platform with a marine intelligence theme, offering real-time conversational AI, immersive 3D visuals, and a sleek modern UI. It leverages OpenRouter API to interface with multiple large language models and features an animated oceanic interface built with Three.js.

---

## 🚀 Features

- **Multi-model AI Chat** — Powered by OpenRouter API, supporting multiple LLMs (GPT-4, Claude, Mistral, and more)
- **3D Ocean Interface** — Immersive Three.js animated background for a distinctive user experience
- **Real-time Streaming** — Token-by-token streaming responses for a fluid chat experience
- **FastAPI Backend** — High-performance Python backend handling LLM routing and API management
- **Next.js Frontend** — SSR-ready React frontend with fast page loads and smooth navigation
- **Responsive Design** — Fully mobile-friendly UI across all device sizes
- **Conversation History** — Persistent chat sessions with history management

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Tailwind CSS |
| 3D Graphics | Three.js |
| Backend | FastAPI (Python) |
| AI / LLM | OpenRouter API |
| Deployment | Vercel (frontend), Railway / Render (backend) |

---

## 📁 Project Structure

```
FloatChat/
├── frontend/                  # Next.js application
│   ├── app/                   # App router pages
│   ├── components/            # Reusable React components
│   │   ├── Chat/              # Chat window, message bubbles
│   │   ├── ThreeScene/        # Three.js ocean canvas
│   │   └── UI/                # Buttons, inputs, modals
│   ├── lib/                   # API helpers, utilities
│   └── public/                # Static assets
│
├── backend/                   # FastAPI application
│   ├── main.py                # Entry point & route definitions
│   ├── routers/               # API route modules
│   ├── services/              # OpenRouter integration, streaming logic
│   └── models/                # Pydantic schemas
│
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

- Node.js >= 18
- Python >= 3.10
- An [OpenRouter API key](https://openrouter.ai/)

### 1. Clone the Repository

```bash
git clone https://github.com/vedantdubey2407/FloatChat.git
cd FloatChat
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
ALLOWED_ORIGINS=http://localhost:3000
```

Start the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 🌐 Deployment

### Frontend (Vercel)

```bash
# Push to GitHub and import the repo on vercel.com
# Set NEXT_PUBLIC_API_URL to your deployed backend URL
```

### Backend (Railway / Render)

```bash
# Connect your GitHub repo and set the following environment variable:
# OPENROUTER_API_KEY=your_key
# Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

> ⚠️ **Cold Start Notice (Render Free Tier)**
>
> The backend is hosted on Render's free plan, which **automatically spins down after 15 minutes of inactivity**.
>
> When you first open the app or return after a period of no use, the backend may take **30 seconds to 1 minute to wake up**. During this time, chat messages may appear to hang or not respond.
>
> **What to do:**
> - Simply **wait 30–60 seconds** and try sending your message again.
> - You can also open the backend health check URL directly in your browser to trigger the wake-up:
>   ```
>   https://<your-render-service>.onrender.com/
>   ```
> - Once the server is awake, all subsequent requests will respond instantly.
>
> This is expected behavior on the free tier and not a bug. To avoid cold starts entirely, consider upgrading to Render's paid plan or migrating to Railway.

---

## 📡 API Reference

### `POST /chat`

Send a message and receive a streamed AI response.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello, who are you?" }
  ],
  "model": "openai/gpt-4o"
}
```

**Response:** Server-Sent Events (SSE) stream of token chunks.

---

### `GET /models`

Returns a list of available LLM models from OpenRouter.

---

## 🎨 Screenshots

> Live demo: [float-chat-kohl.vercel.app](https://float-chat-kohl.vercel.app)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Vedant Dubey**
- GitHub: [@vedantdubey2407](https://github.com/vedantdubey2407)
- Project: [FloatChat](https://float-chat-kohl.vercel.app)

---

> *Built with ❤️ and a love for the ocean.*
