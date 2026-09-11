import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
          type: {
            type: 'STRING',
            description: 'Type of object: "primitive" or "model". Use "model" for complex assets like robots, cars, animals, furniture, lights, etc.'
          },
          modelName: {
            type: 'STRING',
            description: 'If type is "model", specify the asset keyword: "robot", "soldier", "flamingo", "parrot", "stork", "car", "truck", "duck", "avocado", "lantern".'
          },
          modelUrl: {
            type: 'STRING',
            description: 'Optional. Direct HTTPS URL to a custom GLTF/GLB model.'
          },
          geometry: { 
            type: 'STRING',
            description: 'Required if type is "primitive": "box", "sphere", "cylinder", "torus", or "plane".' 
          },
          args: { 
            type: 'ARRAY',
            description: 'Dimensions array. Box: [w, h, d]. Sphere: [radius]. Torus: [radius, tube]. Cylinder: [topR, botR, height]. Plane: [w, h]. For type "model", [w, h, d] scales the model bounding box size (default is [1, 1, 1]).',
            items: { type: 'NUMBER' } 
          },
          color: { type: 'STRING', description: 'Hex color code for mesh. (Ignored or used as tint if type is "model")' },
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
        required: ['type', 'position'],
      },
    },
  },
  required: ['backgroundColor', 'lighting', 'objects'],
};

// 4. Asset Library & Hybrid Asset Loader
const ASSET_LIBRARY = {
  robot: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
  soldier: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb',
  flamingo: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Flamingo.glb',
  parrot: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Parrot.glb',
  stork: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Stork.glb',
  car: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ToyCar/glTF-Binary/ToyCar.glb',
  truck: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
  duck: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb',
  avocado: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb',
  lantern: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb'
};

const gltfLoader = new GLTFLoader();

function showLoadingStatus(message) {
  let statusDiv = document.getElementById('loading-status');
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.id = 'loading-status';
    statusDiv.style.position = 'absolute';
    statusDiv.style.top = '20px';
    statusDiv.style.left = '50%';
    statusDiv.style.transform = 'translateX(-50%)';
    statusDiv.style.background = 'rgba(0, 0, 0, 0.8)';
    statusDiv.style.color = '#fff';
    statusDiv.style.padding = '8px 16px';
    statusDiv.style.borderRadius = '20px';
    statusDiv.style.fontSize = '14px';
    statusDiv.style.zIndex = '100';
    statusDiv.style.fontFamily = 'sans-serif';
    statusDiv.style.pointerEvents = 'none';
    statusDiv.style.border = '1px solid #4f46e5';
    document.body.appendChild(statusDiv);
  }
  statusDiv.style.display = 'block';
  statusDiv.innerText = message;
}

function hideLoadingStatus() {
  const statusDiv = document.getElementById('loading-status');
  if (statusDiv) {
    statusDiv.style.display = 'none';
  }
}

function loadModel(o) {
  const modelName = o.modelName ? o.modelName.toLowerCase() : null;
  const url = o.modelUrl || ASSET_LIBRARY[modelName];

  if (!url) {
    console.warn(`No URL found for model: ${modelName}`);
    return Promise.resolve(null);
  }

  showLoadingStatus(`Loading asset: ${modelName || 'custom'}...`);

  return new Promise((resolve) => {
    gltfLoader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        // Auto-center the model geometry
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center);

        // Group to manage transformed model neatly
        const group = new THREE.Group();
        group.add(model);

        // Normalize bounding box size to 1.0 base
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const baseScale = 1.0 / maxDim;
        model.scale.setScalar(baseScale);

        // Adjust vertical centering so base of model rests at relative ground (y = 0 local in the group)
        model.position.y += (size.y / 2) * baseScale;

        // Apply scale args: default to scale [2, 2, 2] for model size
        const targetScale = o.args || [2, 2, 2];
        group.scale.set(targetScale[0], targetScale[1], targetScale[2]);

        // Place and rotate group
        if (o.position && o.position.length === 3) {
          group.position.set(...o.position);
        }
        if (o.rotation && o.rotation.length === 3) {
          group.rotation.set(...o.rotation);
        }

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Retain material quality but ensure proper lighting environment reactions
            if (child.material) {
              child.material.roughness = o.roughness ?? child.material.roughness;
              child.material.metalness = o.metalness ?? child.material.metalness;
            }
          }
        });

        scene.add(group);
        currentObjects.push(group);
        resolve(group);
      },
      (xhr) => {
        if (xhr.total) {
          const percent = Math.round((xhr.loaded / xhr.total) * 100);
          showLoadingStatus(`Loading ${modelName || 'custom'} asset: ${percent}%`);
        }
      },
      (error) => {
        console.error(`Error loading model from ${url}:`, error);
        // Robust fallback: draw a wireframe box representing the model
        const size = o.args || [1.5, 1.5, 1.5];
        const geometry = new THREE.BoxGeometry(...size);
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(o.color || '#ff4f46'),
          wireframe: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        if (o.position && o.position.length === 3) mesh.position.set(...o.position);
        if (o.rotation && o.rotation.length === 3) mesh.rotation.set(...o.rotation);
        
        scene.add(mesh);
        currentObjects.push(mesh);
        resolve(mesh);
      }
    );
  });
}

let activeSceneState = null;

function updateSceneUI(state) {
  const badge = document.getElementById('scene-status-badge');
  const countSpan = document.getElementById('badge-object-count');
  if (state && state.objects) {
    badge.style.display = 'flex';
    countSpan.innerText = state.objects.length;
  } else {
    badge.style.display = 'none';
  }
}

// 5. Scene Cleanup & Rendering Logic
let currentObjects = [];

function clearScene() {
  currentObjects.forEach((obj) => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  currentObjects = [];
}

async function buildSceneFromJSON(data) {
  clearScene();
  showLoadingStatus('Assembling scene...');

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
    const promises = data.objects.map((o) => {
      if (o.type === 'model') {
        return loadModel(o);
      } else {
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
        return Promise.resolve(mesh);
      }
    });

    await Promise.all(promises);
  }
  hideLoadingStatus();
}

// 6. Gemini Generation Request with Automatic Fallback for 503 Errors
async function generateScene(promptText) {
  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerText = 'Generating...';

  const systemPrompt = `You are an expert 3D level designer using Three.js. 
Translate user requests into precise 3D scenes containing a mix of procedural primitives and external 3D models.
${activeSceneState ? `CURRENT SCENE STATE (JSON): ${JSON.stringify(activeSceneState)}
INSTRUCTION: Modify this scene based on the user's prompt. You can add, remove, or edit objects and lighting while preserving the overall scene structure.` : 'Create a new 3D scene from scratch.'}
Rules:
- Objects can have type "primitive" or "model".
- Supported model keywords (case-insensitive) for type "model":
  "robot", "soldier", "flamingo", "parrot", "stork", "car", "truck", "duck", "avocado", "lantern".
- Use "model" for complex physical objects (e.g., animals, characters, vehicles, robots, props) if they match these keywords.
- Use "primitive" (geometry: box, sphere, cylinder, torus, plane) for standard structural items, floors, abstract shapes, or when no matching model exists.
- Respect relative spatial placement ("on top of", "above", "surrounding", "ground plane").
- Always include a floor plane or base object (as a primitive "plane" or "box") when appropriate.
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
    activeSceneState = sceneJson;
    updateSceneUI(activeSceneState);
    await buildSceneFromJSON(sceneJson);
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
document.getElementById('reset-btn').addEventListener('click', () => {
  activeSceneState = null;
  updateSceneUI(null);
  clearScene();
});

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