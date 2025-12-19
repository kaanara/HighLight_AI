# Highlight AI

A macOS app that shows an AI-powered context menu when you select text in any application. Uses local LLM models via LM Studio.

## Features

- **System-wide text selection**: Works in any macOS app
- **Context menu**: Appears like a right-click menu when text is selected
- **AI Actions**:
  - 📧 **Reply Email**: Generate professional email replies
  - ❓ **Answer Question**: Answer questions or explain selected text
  - ✏️ **Rewrite**: Rewrite text in different styles (Formal, Casual, Shorter, Longer)
- **Local LLM**: Uses LM Studio or any OpenAI-compatible API

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install and Setup LM Studio

#### Install LM Studio

1. Download **LM Studio** from [https://lmstudio.ai/](https://lmstudio.ai/)
2. Install and open LM Studio

#### Download the Model

1. In LM Studio, go to the **Search** tab
2. Search for **"qwen3-4b-2507"** or **"qwen"**
3. Find and download **"qwen/qwen3-4b-2507"** (or similar Qwen model)
4. Wait for the download to complete (the model will appear in the **Local Models** tab)

#### Load the Model

1. Go to the **Chat** tab in LM Studio
2. Click on the model dropdown at the top
3. Select **"qwen/qwen3-4b-2507"** (or the model you downloaded)
4. The model will load into memory (this may take a moment)

#### Start the Local Server

1. Go to the **Local Server** tab in LM Studio (or look for "Server" in the left sidebar)
2. Click **"Start Server"** button
3. Make sure the server is running on:
   - **Port**: `1234` (default)
   - **API Base URL**: `http://localhost:1234/v1`
4. You should see a green indicator showing the server is running
5. **Keep LM Studio running** while using the Highlight AI app

### 3. Update Configuration

Edit `main.js` and update the `LM_CONFIG` object with your model name:

```javascript
const LM_CONFIG = {
  baseURL: 'http://localhost:1234/v1',
  modelName: 'qwen/qwen3-4b-2507' // Update this to match your model name
};
```

**Note**: The model name should match exactly what you see in LM Studio. Common formats:
- `qwen/qwen3-4b-2507`
- `Qwen/Qwen3-4B-2507`
- Or whatever name appears in LM Studio's model list

### 4. Verify LM Studio is Running

Before running the app, test that LM Studio is working:

```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen3-4b-2507",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

If you get a JSON response, LM Studio is working correctly!

### 5. Verify Setup (Optional but Recommended)

Before running the app, verify everything is configured correctly:

```bash
npm run check-setup
```

This will:
- ✅ Check if LM Studio server is running
- ✅ Test the API connection
- ✅ Verify the model is working

If all checks pass, you're ready to go!

### 6. Run the App

```bash
npm start
```

## Usage

**Important**: You must select text BEFORE pressing the shortcut!

1. **First, select/highlight text** in any macOS application (Mail, Safari, Notes, TextEdit, etc.)
   - Click and drag to select text, or double-click to select a word
   - Keep the text selected (don't click away)
2. **Then press Cmd+Shift+A** (or click the menu bar icon)
3. The context menu will appear near your cursor with the selected text
4. Click an AI action button (Reply Email, Answer Question, or Rewrite)
5. Wait for the AI response
6. Copy the result or use it as needed

## Building for Distribution

```bash
npm run build
```

This will create a `.dmg` file in the `dist` folder.

## Requirements

- macOS 10.13 or later
- Node.js 16+ and npm
- **LM Studio** installed and running (download from [https://lmstudio.ai/](https://lmstudio.ai/))
- A compatible LLM model loaded in LM Studio (e.g., `qwen/qwen3-4b-2507`)
- LM Studio local server must be running on `http://localhost:1234/v1`

## Troubleshooting

### LM Studio Connection Issues

If you get "Could not connect to LM Studio" errors:

1. **Check LM Studio is running**:
   - Open LM Studio
   - Go to the **Local Server** tab
   - Make sure the server is **Started** (green indicator)
   - Verify the port is `1234`

2. **Check the model is loaded**:
   - Go to the **Chat** tab
   - Make sure a model is selected and loaded
   - The model name should match what's in `main.js` (`qwen/qwen3-4b-2507`)

3. **Test the API manually**:
   ```bash
   curl http://localhost:1234/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "qwen/qwen3-4b-2507", "messages": [{"role": "user", "content": "test"}]}'
   ```
   - If this works, the issue is with the app
   - If this fails, the issue is with LM Studio setup

4. **Check the model name**:
   - The model name in `main.js` must match exactly what LM Studio shows
   - Check the **Local Models** tab to see the exact model name/ID
   - Update `main.js` if needed

5. **Check console logs**:
   - Look at the terminal where you ran `npm start`
   - You should see "Making request to: http://localhost:1234/v1/chat/completions"
   - Any error messages will help identify the issue

### Text Selection Not Working

If the app can't detect selected text:

1. **Grant Accessibility Permissions**:
   - Go to **System Settings** → **Privacy & Security** → **Accessibility**
   - Find "Highlight AI" (or "Electron" if running in dev mode) in the list
   - Make sure it's **enabled** (checkbox checked)
   - If it's not in the list, run the app once and macOS will prompt you

2. **Make sure text is selected**:
   - Select text by clicking and dragging, or double-clicking a word
   - The text should remain highlighted/selected
   - **Then** press Cmd+Shift+A (not before selecting)

3. **Check the console**:
   - Look at the terminal where you ran `npm start`
   - You should see "Selected text length: X" messages
   - If you see "No text selected", make sure you selected text first

### Shortcut Only Works Once

This should be fixed now. If it still happens:
- Make sure you're not clicking outside the menu window immediately
- Try closing the menu window completely before using the shortcut again
- Restart the app if needed

## Notes

- The app uses AppleScript to get selected text (simulates Cmd+C)
- First time you run, macOS will ask for Accessibility permissions - **you must grant these**
- Make sure LM Studio server is running before using the app
- The app saves and restores your clipboard automatically

