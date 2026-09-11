import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GoogleGenAI } from '@google/genai';

// 1. Initialize Gemini API
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error('CRITICAL: VITE_GEMINI_API_KEY is missing from your .env file!');
}

const ai = new GoogleGenAI({ apiKey: apiKey });

// 2. Setup Three.js Scene, Camera, and Renderer
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 3. Structured JSON Schema with Spatial Descriptions
const sceneSchema = {
  type: 'OBJECT',
  properties: {
    backgroundColor: { 
      type: 'STRING',
      description: 'Hex color string for scene background (e.g., "#050510").'
    },
    lighting: {
      type: 'ARRAY',
      description: 'List of lights in the scene.',
      items: {
        type: 'OBJECT',
        properties: {
          type: { 
            type: 'STRING',
            description: 'Type of light: "ambient", "directional", or "point".'
          },
          color: { type: 'STRING', description: 'Hex color code.' },
          intensity: { type: 'NUMBER', description: 'Brightness multiplier (0.5 to 5).' },
          position: {
            type: 'ARRAY',
            description: '[x, y, z] spatial coordinates.',
            items: { type: 'NUMBER' },
          },
        },
        required: ['type', 'color', 'intensity'],
      },
    },
    objects: {
      type: 'ARRAY',
      description: 'List of 3D objects in the scene.',
      items: {
        type: 'OBJECT',
        properties: {
          geometry: { 
            type: 'STRING',
            description: 'Geometry primitive: "box", "sphere", "cylinder", "torus", or "plane".' 
          },
          args: { 
            type: 'ARRAY',
            description: 'Dimensions array. Box: [w, h, d]. Sphere: [radius]. Torus: [radius, tube]. Cylinder: [topR, botR, height]. Plane: [w, h].',
            items: { type: 'NUMBER' } 
          },
          color: { type: 'STRING', description: 'Hex color code for mesh.' },
          roughness: { type: 'NUMBER', description: '0.0 (smooth) to 1.0 (rough).' },
          metalness: { type: 'NUMBER', description: '0.0 (non-metal) to 1.0 (metallic).' },
          wireframe: { type: 'BOOLEAN' },
          position: { 
            type: 'ARRAY', 
            description: '[x, y, z] coordinates. y=0 represents ground level.',
            items: { type: 'NUMBER' } 
          },
          rotation: { 
            type: 'ARRAY', 
            description: '[x, y, z] rotation values in radians.',
            items: { type: 'NUMBER' } 
          },
        },
        required: ['geometry', 'color', 'position'],
      },
    },
  },
  required: ['backgroundColor', 'lighting', 'objects'],
};

// 4. Scene Cleanup & Rendering Logic
let currentObjects = [];

function clearScene() {
  currentObjects.forEach((obj) => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  currentObjects = [];
}

function buildSceneFromJSON(data) {
  clearScene();

  if (data.backgroundColor) {
    scene.background = new THREE.Color(data.backgroundColor);
  }

  if (data.lighting) {
    data.lighting.forEach((l) => {
      let light;
      const color = new THREE.Color(l.color || '#ffffff');
      const intensity = l.intensity || 1;

      if (l.type === 'ambient') {
        light = new THREE.AmbientLight(color, intensity);
      } else if (l.type === 'directional') {
        light = new THREE.DirectionalLight(color, intensity);
        if (l.position && l.position.length === 3) {
          light.position.set(...l.position);
        } else {
          light.position.set(5, 10, 5);
        }
      } else if (l.type === 'point') {
        light = new THREE.PointLight(color, intensity, 100);
        if (l.position && l.position.length === 3) {
          light.position.set(...l.position);
        }
      }

      if (light) {
        scene.add(light);
        currentObjects.push(light);
      }
    });
  }

  if (data.objects) {
    data.objects.forEach((o) => {
      let geometry;
      const args = o.args || [1, 1, 1];

      switch (o.geometry) {
        case 'sphere':
          geometry = new THREE.SphereGeometry(args[0] || 1, 32, 32);
          break;
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(
            args[0] || 1,
            args[1] || 1,
            args[2] || 2,
            32
          );
          break;
        case 'torus':
          geometry = new THREE.TorusGeometry(
            args[0] || 1,
            args[1] || 0.4,
            16,
            100
          );
          break;
        case 'plane':
          geometry = new THREE.PlaneGeometry(args[0] || 15, args[1] || 15);
          break;
        case 'box':
        default:
          geometry = new THREE.BoxGeometry(
            args[0] || 1,
            args[1] || 1,
            args[2] || 1
          );
          break;
      }

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(o.color || '#ffffff'),
        roughness: o.roughness ?? 0.5,
        metalness: o.metalness ?? 0.1,
        wireframe: o.wireframe || false,
        side: o.geometry === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
      });

      const mesh = new THREE.Mesh(geometry, material);

      if (o.position && o.position.length === 3) mesh.position.set(...o.position);
      if (o.rotation && o.rotation.length === 3) mesh.rotation.set(...o.rotation);

      scene.add(mesh);
      currentObjects.push(mesh);
    });
  }
}

// 5. Gemini Generation Request with Automatic Fallback for 503 Errors
async function generateScene(promptText) {
  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerText = 'Generating...';

  const systemPrompt = `You are an expert 3D level designer using Three.js. 
Translate user requests into precise 3D scenes.
Rules:
- Respect relative spatial placement ("on top of", "above", "surrounding", "ground plane").
- Always include a floor plane or base object when appropriate.
- Use contrasting primary and accent colors with directional and ambient lighting.
- Ensure coordinates fit within x: [-10, 10], y: [-2, 10], z: [-10, 10].`;

  let response;

  try {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `${systemPrompt}\n\nUser Prompt: "${promptText}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: sceneSchema,
        },
      });
    } catch (primaryError) {
      console.warn('gemini-3.6-flash high traffic/unavailable. Trying backup model...', primaryError);
      
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `${systemPrompt}\n\nUser Prompt: "${promptText}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: sceneSchema,
        },
      });
    }

    console.log('Raw Gemini API Response:', response.text);

    const sceneJson = JSON.parse(response.text);
    buildSceneFromJSON(sceneJson);
  } catch (error) {
    console.error('Detailed API Error:', error);
    alert(`Generation failed: ${error.message || 'Check browser console.'}`);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Generate';
  }
}

// 6. Export 3D Model Logic
function exportSceneToGLTF() {
  const exporter = new GLTFExporter();

  const options = {
    binary: true,
    embedImages: true,
  };

  exporter.parse(
    scene,
    (gltf) => {
      const blob = new Blob([gltf], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'generated-3d-scene.glb';
      link.click();
      URL.revokeObjectURL(link.href);
    },
    (error) => {
      console.error('An error occurred while exporting the scene:', error);
    },
    options
  );
}

// 7. Event Listeners
document.getElementById('generate-btn').addEventListener('click', () => {
  const input = document.getElementById('prompt-input');
  if (input.value.trim()) {
    generateScene(input.value.trim());
  }
});

document.getElementById('prompt-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const input = document.getElementById('prompt-input');
    if (input.value.trim()) {
      generateScene(input.value.trim());
    }
  }
});

document.getElementById('export-btn').addEventListener('click', () => {
  exportSceneToGLTF();
});

// 8. Window Resizing & Render Loop
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();