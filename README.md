# 3D Interactive Scene Generator

An AI-promptable, web-based 3D scene generator built using **Three.js**. This application allows users to generate, iteratively edit, and customize 3D scenes using natural language prompts or quick presets, featuring cinematic studio lighting, a glossy floor system, active scene status management, and `.GLB` export support.

---

## Features

- **Prompt-Driven 3D Scene Generation:** Type natural language prompts to create custom 3D low-poly objects and dynamic environments.
- **Conversational Delta Editing:** Modify active scenes incrementally while tracking total object counts dynamically via the scene status badge.
- **Interactive Preset Tags:** Quick-load predefined 3D models (Robot, Toy Car, Flamingo, Avocado, Lantern, and more) into cinematic studio settings.
- **GLTF/GLB Export:** Export your generated 3D scenes directly into `.GLB` format for use in Blender, game engines, or web applications.
- **Glossy Floor & Studio Lighting:** Built-in lighting setups and reflective floor geometry for visually rich, high-quality renders.
- **Scene Control & Reset:** Manage your workspace in real time with quick-reset options and customizable prompt inputs.

---

## Tech Stack

- **3D Engine & Rendering:** Three.js
- **Module Bundler:** Vite (ES Modules)
- **Exporting:** Three.js GLTFExporter
- **Frontend:** HTML5, CSS3 (Modern Floating Glassmorphism UI), Vanilla JavaScript (ES6+)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- Modern web browser with WebGL support (Chrome, Edge, Firefox, or Safari)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/3d-scene-generator.git](https://github.com/your-username/3d-scene-generator.git)
   cd 3d-scene-generator
