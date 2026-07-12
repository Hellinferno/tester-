# UI/UX Design Document

## 1. Design System

### 1.1 Color Palette

```css
:root {
 /* Primary */
 --color-primary-50: #eff6ff;
 --color-primary-100: #dbeafe;
 --color-primary-200: #bfdbfe;
 --color-primary-300: #93c5fd;
 --color-primary-400: #60a5fa;
 --color-primary-500: #3b82f6;
 --color-primary-600: #2563eb;
 --color-primary-700: #1d4ed8;
 --color-primary-800: #1e40af;
 --color-primary-900: #1e3a8a;

 /* Neutral */
 --color-gray-50: #f9fafb;
 --color-gray-100: #f3f4f6;
 --color-gray-200: #e5e7eb;
 --color-gray-300: #d1d5db;
 --color-gray-400: #9ca3af;
 --color-gray-500: #6b7280;
 --color-gray-600: #4b5563;
 --color-gray-700: #374151;
 --color-gray-800: #1f2937;
 --color-gray-900: #111827;

 /* Semantic */
 --color-success: #10b981;
 --color-warning: #f59e0b;
 --color-error: #ef4444;
 --color-info: #3b82f6;

 /* Background */
 --bg-primary: #ffffff;
 --bg-secondary: #f9fafb;
 --bg-dark: #111827;
 --bg-dark-secondary: #1f2937;
}
```

### 1.2 Typography

```css
:root {
 --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
 --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

 --text-xs: 0.75rem; /* 12px */
 --text-sm: 0.875rem; /* 14px */
 --text-base: 1rem; /* 16px */
 --text-lg: 1.125rem; /* 18px */
 --text-xl: 1.25rem; /* 20px */
 --text-2xl: 1.5rem; /* 24px */
 --text-3xl: 1.875rem; /* 30px */
 --text-4xl: 2.25rem; /* 36px */

 --font-normal: 400;
 --font-medium: 500;
 --font-semibold: 600;
 --font-bold: 700;

 --leading-tight: 1.25;
 --leading-normal: 1.5;
 --leading-relaxed: 1.625;
}
```

### 1.3 Spacing & Layout

```css
:root {
 --space-1: 0.25rem; /* 4px */
 --space-2: 0.5rem; /* 8px */
 --space-3: 0.75rem; /* 12px */
 --space-4: 1rem; /* 16px */
 --space-5: 1.25rem; /* 20px */
 --space-6: 1.5rem; /* 24px */
 --space-8: 2rem; /* 32px */
 --space-10: 2.5rem; /* 40px */
 --space-12: 3rem; /* 48px */

 --radius-sm: 0.25rem;
 --radius-md: 0.375rem;
 --radius-lg: 0.5rem;
 --radius-xl: 0.75rem;
 --radius-2xl: 1rem;
 --radius-full: 9999px;
}
```

### 1.4 Shadows & Effects

```css
:root {
 --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
 --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
 --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
 --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

 --transition-fast: 150ms ease;
 --transition-normal: 250ms ease;
 --transition-slow: 350ms ease;
}
```

## 2. Component Library

### 2.1 Query Builder

The main interface for submitting multi-modal queries.

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔍 What would you like to know? │ │
│ │ │ │
│ │ [Type your question here...] │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │ 📷 │ │ 🎤 │ │ 📄 │ │ 🎬 │ │
│ │ Image │ │ Voice │ │ Text │ │ Combo │ │
│ │ Only │ │ Only │ │ Only │ │ Mode │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
│ │
│ [Drop files here or click to upload] │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🖼️ diagram.png 2.4 MB [✕] │ │
│ │ 🎵 question.mp3 1.8 MB [✕] │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ System Instruction: Technical Analysis [▼] │ │
│ │ Model: Auto-select [▼] Temperature: 0.7 [━━━●──] │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ [ Submit Query ] │
│ │
└─────────────────────────────────────────────────────────────┘
```

**States:**
- Empty: Placeholder text, upload area highlighted
- Filling: Character counter, file previews, validation indicators
- Ready: Submit button enabled, all validations passed
- Submitting: Loading spinner, progress indicators
- Streaming: Response appears token by token

### 2.2 Response Display

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🤖 Response from Claude 3.5 Sonnet │ │
│ │ ⏱️ 2.3s 💰 $0.0024 🔍 High Complexity │ │
│ │ │ │
│ │ The architecture diagram shows a microservices │ │
│ │ pattern with the following components: │ │
│ │ │ │
│ │ 1. **API Gateway** (Kong) │ │
│ │ - Handles authentication │ │
│ │ - Rate limiting │ │
│ │ │ │
│ │ ```python │ │
│ │ def example(): │ │
│ │ return "code blocks supported" │ │
│ │ ``` │ │
│ │ │ │
│ │ [👍] [👎] [🔄 Regenerate] [💾 Save] │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📊 Analysis Details │ │
│ │ ├─ Complexity: ████████░░ High (0.85) │ │
│ │ ├─ Subject: Computer Science │ │
│ │ ├─ Reasoning: Analytical (3 steps) │ │
│ │ ├─ Intent: explain_architecture │ │
│ │ └─ Confidence: 92% │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 System Instruction Editor

Based on the Google AI Studio reference images, this component allows users to configure AI behavior.

```
┌─────────────────────────────────────────────────────────────┐
│ System Instructions [✕] │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [+ Create new instruction] │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ Title │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Technical Analysis │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ Instructions │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ You are a technical analyst. Provide detailed, │ │
│ │ structured explanations with code examples when │ │
│ │ relevant. Be precise and cite sources. │ │
│ │ │ │
│ │ │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ Configuration │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ │ │
│ │ Temperature [━━━●──] 0.7 │ │
│ │ │ │
│ │ Thinking Mode [●────] On │ │
│ │ ├─ Thinking Budget [━━━━●━] 4000 │ │
│ │ │ │
│ │ Structured Outputs [○────] Off │ │
│ │ Code Execution [○────] Off │ │
│ │ Function Calling [○────] Off │ │
│ │ │ │
│ │ Grounding with Google Search [●────] On │ │
│ │ Grounding with Google Maps [○────] Off │ │
│ │ URL Context [●────] On │ │
│ │ │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ Applicability │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Modalities: [✓] Image+Text [✓] Text Only │ │
│ │ Subjects: [Computer Science] [Mathematics] [+] │ │
│ │ Complexity: [✓] Medium [✓] High [✓] Critical │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ [💾 Save] [🗑️ Delete] [↩️ Reset] │
│ │
│ Instructions are saved in local storage. │
└─────────────────────────────────────────────────────────────┘
```

**Toggle Switch Design:**
```
Off: [○────] | On: [●────]
 Gray Blue/Primary
```

**Slider Design:**
```
[━━━●──] 0.7
Track: Gray-200
Thumb: Primary-500
Active: Primary-100
```

### 2.4 OCR Testing Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ OCR Testing [?] │
│ │
│ ┌─────────────────┐ ┌─────────────────────────────────┐ │
│ │ Upload Test │ │ Test Library │ │
│ │ Image │ │ ┌─────────────────────────┐ │ │
│ │ │ │ │ Printed Documents │ 50 │ │ │
│ │ [Drop image │ │ │ Handwriting │ 30 │ │ │
│ │ or click] │ │ │ Screenshots │ 20 │ │ │
│ │ │ │ └─────────────────────────┘ │ │
│ └─────────────────┘ └─────────────────────────────────┘ │
│ │
│ Ground Truth │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Enter expected text... or select from library] │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ Engines: [✓] Tesseract [✓] EasyOCR [✓] PaddleOCR │
│ Preprocessing: [✓] Denoise [✓] Deskew [✓] Contrast │
│ │
│ [ Run Test ] │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Results │ │
│ │ ┌─────────┬──────────┬────────┬────────┬────────┐ │ │
│ │ │ Engine │ CER │ WER │ Time │ Conf │ │ │
│ │ ├─────────┼──────────┼────────┼────────┼────────┤ │ │
│ │ │ Tesseract│ 1.2% │ 3.4% │ 450ms │ 0.95 │ │ │
│ │ │ EasyOCR │ 2.1% │ 4.8% │ 820ms │ 0.91 │ │ │
│ │ │ PaddleOCR│ 1.8% │ 4.2% │ 680ms │ 0.93 │ │ │
│ │ └─────────┴──────────┴────────┴────────┴────────┘ │ │
│ │ │ │
│ │ [View Visual Diff] [Export PDF] [Export CSV] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 STT Testing Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ STT Testing [?] │
│ │
│ ┌─────────────────┐ ┌─────────────────────────────────┐ │
│ │ Upload Test │ │ Test Library │ │
│ │ Audio │ │ ┌─────────────────────────┐ │ │
│ │ │ │ │ Clean Speech │ 30 │ │ │
│ │ [Drop audio │ │ │ Noisy Audio │ 20 │ │ │
│ │ or click] │ │ │ Accented Speech │ 20 │ │ │
│ │ │ │ └─────────────────────────┘ │ │
│ └─────────────────┘ └─────────────────────────────────┘ │
│ │
│ Ground Truth │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Enter expected transcript...] │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ Engines: [✓] Whisper [✓] Deepgram │
│ Options: [✓] Word Timestamps [ ] Speaker Diarization │
│ │
│ [ Run Test ] │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Results │ │
│ │ ┌─────────┬────────┬────────┬────────┬────────┐ │ │
│ │ │ Engine │ WER │ MER │ WIL │ RTF │ │ │
│ │ ├─────────┼────────┼────────┼────────┼────────┤ │ │
│ │ │ Whisper │ 4.2% │ 3.1% │ 3.8% │ 0.42 │ │ │
│ │ │ Deepgram │ 3.8% │ 2.9% │ 3.5% │ 0.18 │ │ │
│ │ └─────────┴────────┴────────┴────────┴────────┘ │ │
│ │ │ │
│ │ [▶️ Play Audio] [View Transcript Overlay] │ │
│ │ [Export PDF] [Export CSV] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.6 Analytics Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ Analytics [⚙️] │
│ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ 15,420 │ │ 3.2s │ │ $45.23 │ │
│ │ Total Req │ │ Avg Latency │ │ Total Cost │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ │
│ │
│ ┌─────────────────────────┐ ┌─────────────────────────┐ │
│ │ Queries by Modality │ │ Response Time Trend │ │
│ │ │ │ │ │
│ │ 📷 35% │ │ ╱╲ ╱╲ │ │
│ │ 🎤 15% │ │ ╱ ╲ ╱ ╲ │ │
│ │ 📝 45% │ │ ╱ ╲╱ ╲ │ │
│ │ 🎬 5% │ │ ╱ ╲ │ │
│ │ │ │ │ │
│ └─────────────────────────┘ └─────────────────────────┘ │
│ │
│ ┌─────────────────────────┐ ┌─────────────────────────┐ │
│ │ Model Usage │ │ Cost Breakdown │ │
│ │ │ │ │ │
│ │ Claude ████████░░ 45% │ │ Input tokens $28.50 │ │
│ │ GPT-4o ██████░░░░ 35% │ │ Output tokens $12.30 │ │
│ │ Gemini ███░░░░░░░ 20% │ │ Processing $4.43 │ │
│ │ │ │ │ │
│ └─────────────────────────┘ └─────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Routing Accuracy Over Time │ │
│ │ ═══════════════════════════════════════════════ │ │
│ │ 95% ┤ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● │ │
│ │ 90% ┤ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● │ │
│ │ 85% ┤●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● │ │
│ │ └────────────────────────────────────────── │ │
│ │ Jan Feb Mar Apr May Jun Jul │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ [📥 Export Report] [🔍 View Details] │
└─────────────────────────────────────────────────────────────┘
```

## 3. Responsive Design

### 3.1 Breakpoints

```css
/* Mobile First */
--breakpoint-sm: 640px; /* Small tablets */
--breakpoint-md: 768px; /* Tablets */
--breakpoint-lg: 1024px; /* Laptops */
--breakpoint-xl: 1280px; /* Desktops */
--breakpoint-2xl: 1536px; /* Large screens */
```

### 3.2 Layout Adaptations

**Mobile (< 768px):**
- Single column layout
- Bottom sheet for configuration
- Full-screen media preview
- Simplified analytics (scrollable cards)

**Tablet (768px - 1024px):**
- Two-column layout for dashboard
- Side panel for configuration
- Split view for query builder

**Desktop (> 1024px):**
- Three-column layout
- Persistent side panels
- Floating analysis details
- Multi-window support

## 4. Interaction Design

### 4.1 Micro-interactions

**Upload Drag & Drop:**
- Default: Dashed border, gray background
- Drag over: Solid border, blue background, scale 1.02
- Drop: Green flash, checkmark animation
- Error: Red flash, shake animation

**Streaming Response:**
- Cursor blink during generation
- Smooth scroll to new content
- Token-by-token fade-in (opacity 0→1, 50ms)
- Completion: Checkmark pulse

**Toggle Switches:**
- Tap: Thumb slides with spring physics
- Color transition: 200ms ease
- Haptic feedback on mobile (if available)

**Analysis Panel:**
- Expand: Height animation 300ms ease-out
- Collapse: Height animation 200ms ease-in
- Complexity bar: Width animation 500ms ease-out

### 4.2 Loading States

**Skeleton Screens:**
```
┌─────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└─────────────────────────────────────────────────────┘
```

**Progress Indicators:**
- Circular spinner for < 3s operations
- Linear progress bar for > 3s operations
- Step indicator for multi-stage processing:
 ```
 [✓] Upload → [✓] OCR → [●] Analyze → [ ] Route → [ ] Generate
 ```

## 5. Accessibility

### 5.1 WCAG 2.1 AA Compliance

- **Color Contrast**: Minimum 4.5:1 for text
- **Keyboard Navigation**: All interactive elements accessible via Tab
- **Screen Readers**: ARIA labels for all icons and toggles
- **Focus Indicators**: Visible focus rings (2px blue outline)
- **Alt Text**: All images have descriptive alt text
- **Reduced Motion**: Respect `prefers-reduced-motion`

### 5.2 Voice Input Support

- Microphone button with keyboard shortcut (Ctrl+Shift+M)
- Visual waveform during recording
- Transcript preview before submission
- Voice commands: "Submit", "Clear", "Add image"

## 6. Dark Mode

```css
[data-theme="dark"] {
 --bg-primary: #111827;
 --bg-secondary: #1f2937;
 --text-primary: #f9fafb;
 --text-secondary: #d1d5db;
 --border-color: #374151;
 --shadow-color: rgba(0, 0, 0, 0.3);
}
```

**Dark Mode Components:**
- Cards: Slightly lighter than background (bg-secondary)
- Inputs: Darker with subtle borders
- Code blocks: High contrast syntax highlighting
- Charts: Adjusted color palette for visibility

---
*Version: 1.0 | Date: 2026-07-12*
