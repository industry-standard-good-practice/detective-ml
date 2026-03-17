
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import styled from 'styled-components';

const OverlayContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  pointer-events: none; /* Let clicks pass through */
  overflow: hidden;

  /* Ensure the Three.js canvas also never captures events */
  & > * {
    pointer-events: none;
  }
`;

const CRTOverlay: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });

    // Initial Size
    const { clientWidth, clientHeight } = mountRef.current;
    renderer.setSize(clientWidth, clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // Shader Material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(clientWidth, clientHeight) },
        u_distortion: { value: 0.0 },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform float u_distortion;
        uniform vec2 u_mouse;
        varying vec2 vUv;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        float noise(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec2 uv = vUv;

          // 1. Curvature (Fish-eye effect)
          // Scale up before distortion to push curved border closer to edges
          // while preserving the same curve shape
          vec2 crtUV = uv * 2.0 - 1.0;
          float edgeScale = 1.01; // >1 = thinner border band
          vec2 scaledUV = crtUV * edgeScale;
          vec2 offset = scaledUV.yx / vec2(6.0, 6.0);
          scaledUV = scaledUV + scaledUV * offset * offset;
          crtUV = scaledUV / edgeScale;
          uv = crtUV * 0.5 + 0.5;

          // Black out edges outside the curve (fully opaque to clip content)
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }
          // Subtle edge fade near the curved boundary
          float edgeFade = smoothstep(0.0, 0.01, uv.x) * smoothstep(0.0, 0.01, uv.y)
                         * smoothstep(0.0, 0.01, 1.0 - uv.x) * smoothstep(0.0, 0.01, 1.0 - uv.y);



          // 2. Click Distortion (Heavy Glitch Tearing)
          float shake = u_distortion;
          if (shake > 0.0) {
             float yBlock = floor(uv.y * 30.0);
             float xNoise = noise(vec2(yBlock, u_time * 20.0));
             if (xNoise < shake) {
                // Shift horizontal strips violently
                uv.x += (random(vec2(u_time)) - 0.5) * 0.2 * shake;
                // Add some RGB color noise during glitch
                uv.y += (random(vec2(u_time * 1.5)) - 0.5) * 0.05 * shake;
             }
          }

          // 3. Chromatic Aberration
          vec2 toMouse = uv - u_mouse;
          // Adjust aspect ratio for circular distance calculation
          float aspect = u_resolution.x / u_resolution.y;
          toMouse.x *= aspect;
          float distToMouse = length(toMouse);
          
          // Make it much more localized (tighter radius) and stronger intensity
          // Radius: 0.15 (very local)
          float localized = 1.0 - smoothstep(0.0, 0.15, distToMouse);
          
          // Base global aberration + Strong local mouse aberration
          float abStrength = 0.002 * length(crtUV) + (0.02 * localized);
          abStrength += shake * 0.02;

          // 4. Scanlines
          float scanFreq = 400.0;
          float scanSpeed = 5.0;

          // Apply aberration to the phase of the scanlines
          float scanR = sin((uv.y + abStrength) * scanFreq - u_time * scanSpeed);
          float scanG = sin(uv.y * scanFreq - u_time * scanSpeed);
          float scanB = sin((uv.y - abStrength) * scanFreq - u_time * scanSpeed);

          scanR = 0.8 + 0.2 * scanR;
          scanG = 0.8 + 0.2 * scanG;
          scanB = 0.8 + 0.2 * scanB;

          // 5. Vignette - Adjusted power for rectangular feel
          float vig = 25.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y); // Was 16.0, higher means tighter/sqaurer vignette focus
          vig = pow(vig, 0.15); // Was 0.2, lower power softens the falloff

          // 6. Composition
          vec3 color = vec3(1.0);
          
          color.r *= scanR;
          color.g *= scanG;
          color.b *= scanB;

          float n = random(uv + u_time * 10.0);
          color -= n * 0.05; // Reduced noise slightly

          // Alpha calc — interior effects at reduced opacity, edges fully opaque
          float avgColor = (color.r + color.g + color.b) / 3.0;
          float interiorAlpha = (1.0 - avgColor) * 0.5; 
          
          interiorAlpha += (1.0 - vig);
          
          if (shake > 0.0) {
             color += vec3(shake * 0.5);
             interiorAlpha += shake * 0.2;
          }

          vec3 finalColor = mix(vec3(0.0), color, vig);

          float alpha = mix(1.0, interiorAlpha * 0.4, edgeFade);
          finalColor = mix(vec3(0.0), finalColor, edgeFade);

          gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthTest: false,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(plane);

    // Animation state
    let distortionValue = 0;
    let targetDistortion = 0;

    const animate = (time: number) => {
      // Decay distortion
      distortionValue += (targetDistortion - distortionValue) * 0.1;
      if (targetDistortion > 0) targetDistortion *= 0.8; // Fast decay
      if (distortionValue < 0.001) distortionValue = 0;

      material.uniforms.u_time.value = time * 0.001;
      material.uniforms.u_distortion.value = distortionValue;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    const handleResize = () => {
      if (!mountRef.current) return;
      const { clientWidth, clientHeight } = mountRef.current;
      renderer.setSize(clientWidth, clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      material.uniforms.u_resolution.value.set(clientWidth, clientHeight);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!mountRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      material.uniforms.u_mouse.value.set(x, y);
    };

    const handleClick = () => {
      targetDistortion = 1.0;
      material.uniforms.u_time.value += 10.0;
    };

    // Attach resize to ResizeObserver
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mountRef.current);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    const animId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      resizeObserver.disconnect();
      cancelAnimationFrame(animId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <OverlayContainer ref={mountRef} />;
};

export default CRTOverlay;
