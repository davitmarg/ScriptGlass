# ScriptGlass

ScriptGlass is a professional, cloud-native screenplay editor designed for screenwriters who value speed, simplicity, and version control. It combines the power of the **Fountain** syntax with deep **GitHub integration**, allowing you to write, sync, and export your scripts seamlessly.

## Editor Capabilities

ScriptGlass is designed to be a distraction-free writing environment that understands the nuances of screenwriting. Unlike a standard text editor, it interprets your intent in real-time, providing a rhythmic and fluid writing experience that feels natural to professional writers.

## What the Editor Supports

- **Smart Formatting**: Context-aware writing that knows you're about to write dialogue after a character name.
- **Interactive Page Navigation**: Real-time page counting that respects your manual spacing. Click the page indicator in the footer to jump instantly to any page.
- **Scene Navigator**: A dedicated outline view in the sidebar that allows you to jump between scenes with a single click.
- **AI Enhancement**: Highlight snippets of your script to get AI-powered suggestions for dialogue or action enhancements.
- **Standard Fountain Syntax**: Supports Scene Headings (starting with `.` or `INT.`), Transitions (`>`), Shots (`!`), Parentheticals `()`, and more.
- **Hotkey Support**: Quick formatting buttons and Alt/Cmd shortcuts (1-7) to manually set line types.
- **Empty Line Preservation**: Full support for manual vertical spacing, ensuring your script's rhythm is preserved both in the editor and PDF export.
- **Integrated Development**: Access a built-in terminal to manage files or run local scripts without leaving the editor.
- **Cloud Sync**: Secure, private GitHub integration for version history and cross-device backups.

## Technical Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Motion (formerly Framer Motion).
- **Backend**: Express (Node.js) for file management and Git orchestration.
- **Integration**: `simple-git` for repository management and `jsPDF` for screenplay rendering.
- **Icons**: Lucide React.

## Getting Started

1. **Connect GitHub**: Go to Settings (gear icon) and add your GitHub Personal Access Token to enable syncing.
2. **Create or Clone**: Start a new project from scratch or clone an existing screenplay repository.
3. **Write**: Start typing! Use standard Fountain syntax.
4. **Sync**: Use the Cloud icon to push your latest drafts to GitHub.
5. **Export**: Click "Export PDF" to generate your final script.

---
Built with focus by ScriptGlass.
