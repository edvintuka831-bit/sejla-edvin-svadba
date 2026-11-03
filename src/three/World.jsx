import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { glowTexture, pavingTexture, petalTexture } from './textures.js'

// Svijet se kreće ispod automobila (automobil je u ishodištu):
// arkade, lampioni, čempresi i cvijeće se ponavljaju u segmentima i "teku" unazad.
export const SEGMENT = 12
export const SEGMENTS = 11
const BEHIND = 26

export const wrapZ = (i, travel) => {
  const span = SEGMENT * SEGMENTS
  return ((((i * SEGMENT + travel) % span) + span) % span) - (span - BEHIND)
}

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

// Spoji više geometrija (sa pozicijom/rotacijom/skalom) u jednu.
function merge(parts) {
  const geos = parts.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone())
    g.deleteAttribute('uv')
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale),
    )
    g.applyMatrix4(m)
    return g
  })
  return mergeGeometries(geos, false)
}

const ARCH_X = 3.95
const ARCH_Y = 4.45

function buildSegment(quality) {
  const r = rng(11)
  const stone = []
  const white = []
  const blush = []
  const leaf = []
  const lamp = []
  const metal = []
  const cypress = []

  // --- arkada: dva stuba + polukružni luk ---
  for (const s of [-1, 1]) {
    const x = s * ARCH_X
    stone.push([new THREE.BoxGeometry(0.9, 0.45, 0.9), [x, 0.22, 0]])
    stone.push([new THREE.CylinderGeometry(0.27, 0.31, 3.9, 20), [x, 2.4, 0]])
    stone.push([new THREE.CylinderGeometry(0.36, 0.3, 0.18, 20), [x, 0.53, 0]])
    stone.push([new THREE.BoxGeometry(0.82, 0.24, 0.82), [x, 4.42, 0]])
    // lampion pored stuba
    const lx = s * 5.0
    metal.push([new THREE.CylinderGeometry(0.045, 0.06, 2.7, 8), [lx, 1.35, 1.2]])
    metal.push([new THREE.ConeGeometry(0.24, 0.22, 4), [lx, 3.12, 1.2], [0, Math.PI / 4, 0]])
    lamp.push([new THREE.BoxGeometry(0.3, 0.42, 0.3), [lx, 2.82, 1.2]])
    metal.push([new THREE.BoxGeometry(0.36, 0.05, 0.36), [lx, 2.6, 1.2]])

    // živica s cvijećem uz aleju
    leaf.push([new THREE.BoxGeometry(0.9, 0.62, SEGMENT - 2.6), [s * 5.6, 0.31, -SEGMENT / 2]])
    const n = quality === 'low' ? 10 : 18
    for (let i = 0; i < n; i++) {
      const z = -1.6 - (i / (n - 1)) * (SEGMENT - 3.4)
      const g = new THREE.IcosahedronGeometry(0.17 + r() * 0.08, 1)
      ;(r() > 0.7 ? blush : white).push([g, [s * (5.6 + (r() - 0.5) * 0.6), 0.66 + r() * 0.12, z + (r() - 0.5) * 0.3]])
    }
    // čempresi
    cypress.push([new THREE.ConeGeometry(0.85, 6.2, 10), [s * 8.4, 3.1, -6]])
    cypress.push([new THREE.ConeGeometry(0.7, 5.0, 10), [s * 11.2, 2.5, -1.5]])
  }
  stone.push([new THREE.TorusGeometry(ARCH_X, 0.22, 12, 48, Math.PI), [0, ARCH_Y, 0]])
  stone.push([new THREE.TorusGeometry(ARCH_X + 0.05, 0.07, 8, 48, Math.PI), [0, ARCH_Y, 0.24]])
  stone.push([new THREE.TorusGeometry(ARCH_X + 0.05, 0.07, 8, 48, Math.PI), [0, ARCH_Y, -0.24]])
  metal.push([new THREE.OctahedronGeometry(0.16), [0, ARCH_Y + ARCH_X + 0.3, 0]])

  // cvjetni vijenac preko luka
  const count = quality === 'low' ? 26 : 44
  for (let i = 0; i < count; i++) {
    const a = 0.06 + (i / (count - 1)) * (Math.PI - 0.12)
    const rr = ARCH_X + (r() - 0.5) * 0.25
    const p = [Math.cos(a) * rr, ARCH_Y + Math.sin(a) * rr, (r() - 0.5) * 0.5]
    const size = 0.18 + r() * 0.12 + (Math.abs(a - Math.PI / 2) > 1.2 ? 0.06 : 0)
    if (r() > 0.4) (r() > 0.62 ? blush : white).push([new THREE.IcosahedronGeometry(size, 1), p])
    else leaf.push([new THREE.IcosahedronGeometry(size * 0.9, 0), p])
  }
  // viseći buketi na kapitelima
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const p = [s * (ARCH_X + (r() - 0.5) * 0.5), 4.1 - r() * 1.1, (r() - 0.5) * 0.7]
      ;(i % 3 === 0 ? leaf : r() > 0.5 ? blush : white).push([new THREE.IcosahedronGeometry(0.15 + r() * 0.1, 1), p])
    }
  }

  return {
    stone: merge(stone),
    white: merge(white),
    blush: merge(blush),
    leaf: merge(leaf),
    lamp: merge(lamp),
    metal: merge(metal),
    cypress: merge(cypress),
  }
}

export const MATERIALS = {
  stone: new THREE.MeshStandardMaterial({ color: '#f7efe2', roughness: 0.62 }),
  white: new THREE.MeshStandardMaterial({ color: '#fffbf4', roughness: 0.6 }),
  blush: new THREE.MeshStandardMaterial({ color: '#f0cfc1', roughness: 0.6 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#8a9670', roughness: 0.85, flatShading: true }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 2.4 }),
  metal: new THREE.MeshStandardMaterial({ color: '#c9a55e', metalness: 1, roughness: 0.3 }),
  cypress: new THREE.MeshStandardMaterial({ color: '#5f6e4f', roughness: 0.9, flatShading: true }),
}

// Segmenti kao InstancedMesh – mali broj draw-poziva, brzo i na mobitelima.
export function Arcades({ quality, travelRef, hideBeyondRef }) {
  const geos = useMemo(() => buildSegment(quality), [quality])
  const refs = useRef({})
  const glowRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const glowTex = useMemo(() => glowTexture(), [])

  useFrame(() => {
    const travel = travelRef.current
    const limit = hideBeyondRef.current
    for (let i = 0; i < SEGMENTS; i++) {
      const z = wrapZ(i, travel)
      dummy.position.set(0, 0, z)
      dummy.scale.setScalar(z < limit ? 0.0001 : 1)
      dummy.updateMatrix()
      for (const key in refs.current) refs.current[key]?.setMatrixAt(i, dummy.matrix)
      if (glowRef.current) {
        for (let s = 0; s < 2; s++) {
          dummy.position.set(s ? 5 : -5, 2.82, z + 1.2)
          dummy.updateMatrix()
          glowRef.current.setMatrixAt(i * 2 + s, dummy.matrix)
        }
      }
    }
    for (const key in refs.current) if (refs.current[key]) refs.current[key].instanceMatrix.needsUpdate = true
    if (glowRef.current) glowRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {Object.keys(geos).map((key) => (
        <instancedMesh
          key={key}
          ref={(el) => {
            refs.current[key] = el
          }}
          args={[geos[key], MATERIALS[key], SEGMENTS]}
          castShadow={key !== 'lamp'}
          receiveShadow={key === 'stone' || key === 'leaf'}
          frustumCulled={false}
        />
      ))}
      <GlowSprites ref={glowRef} count={SEGMENTS * 2} texture={glowTex} />
    </group>
  )
}

// Sjaj lampiona: instancirani "billboard" kvadrati koji uvijek gledaju u kameru.
const GlowSprites = forwardRef(function GlowSprites({ count, texture }, ref) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { map: { value: texture }, size: { value: 2.2 }, opacity: { value: 0.85 } },
        vertexShader: `
          uniform float size;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy * size;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D map;
          uniform float opacity;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(map, vUv);
            gl_FragColor = vec4(c.rgb, c.a * opacity);
            #include <colorspace_fragment>
          }`,
      }),
    [texture],
  )
  return <instancedMesh ref={ref} args={[new THREE.PlaneGeometry(1, 1), material, count]} frustumCulled={false} renderOrder={5} />
})

// Rotonda – kuća mlade na kraju puta (pojavljuje se pred kraj pozivnice).
export function Rotunda({ groupRef }) {
  const parts = useMemo(() => {
    const cols = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2)
    return { cols }
  }, [])
  const glowTex = useMemo(() => glowTexture(), [])
  const flowers = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 70 }, (_, i) => {
        const a = (i / 70) * Math.PI * 2
        const rad = 6.3 + r() * 0.5
        return { p: [Math.cos(a) * rad, 0.75 + r() * 0.35, Math.sin(a) * rad], s: 0.22 + r() * 0.12, b: r() > 0.65 }
      })
  }, [])
  return (
    <group ref={groupRef} position={[0, 0, -200]}>
      {[7.4, 6.6, 5.8].map((rad, i) => (
        <mesh key={rad} position={[0, 0.2 + i * 0.3, 0]} material={MATERIALS.stone} receiveShadow castShadow>
          <cylinderGeometry args={[rad, rad + 0.1, 0.3, 48]} />
        </mesh>
      ))}
      {parts.cols.map((a) => (
        <group key={a} position={[Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6]}>
          <mesh position={[0, 3.6, 0]} material={MATERIALS.stone} castShadow>
            <cylinderGeometry args={[0.3, 0.34, 5.2, 18]} />
          </mesh>
          <mesh position={[0, 6.3, 0]} material={MATERIALS.stone}>
            <boxGeometry args={[0.85, 0.3, 0.85]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 6.7, 0]} material={MATERIALS.stone} castShadow>
        <cylinderGeometry args={[5.4, 5.4, 0.7, 48]} />
      </mesh>
      <mesh position={[0, 7.1, 0]} material={MATERIALS.metal}>
        <torusGeometry args={[5.4, 0.08, 8, 64]} />
      </mesh>
      <mesh position={[0, 7.05, 0]} material={MATERIALS.stone} castShadow>
        <sphereGeometry args={[4.9, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 12.2, 0]} material={MATERIALS.metal}>
        <coneGeometry args={[0.28, 0.9, 12]} />
      </mesh>
      <mesh position={[0, 12.8, 0]} material={MATERIALS.metal}>
        <sphereGeometry args={[0.18, 16, 12]} />
      </mesh>
      {/* topli sjaj iznutra */}
      <mesh position={[0, 3.5, 0]} material={MATERIALS.lamp}>
        <sphereGeometry args={[0.5, 20, 16]} />
      </mesh>
      <pointLight position={[0, 4, 0]} color="#ffcf8a" intensity={60} distance={18} decay={2} />
      <sprite position={[0, 3.5, 0]} scale={[7, 7, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.9} />
      </sprite>
      {flowers.map((f, i) => (
        <mesh key={i} position={f.p} material={f.b ? MATERIALS.blush : MATERIALS.white} castShadow>
          <icosahedronGeometry args={[f.s, 1]} />
        </mesh>
      ))}
    </group>
  )
}

// Aleja s kamenim pločama (pomjera teksturu = osjećaj vožnje) + reflektujuća površina.
export function Road({ quality, travelRef, reflect }) {
  const { gl } = useThree()
  const tex = useMemo(() => {
    const t = pavingTexture(Math.min(8, gl.capabilities.getMaxAnisotropy()))
    t.repeat.set(1, 22)
    return t
  }, [gl])
  useEffect(() => () => tex.dispose(), [tex])
  useFrame(() => {
    tex.offset.y = travelRef.current / (220 / 22)
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -80]} receiveShadow>
        <planeGeometry args={[7, 220]} />
        {reflect ? (
          <MeshReflectorMaterial
            map={tex}
            color="#efe4d2"
            resolution={quality === 'high' ? 1024 : 384}
            blur={[260, 80]}
            mixBlur={0.9}
            mixStrength={1.1}
            mixContrast={1}
            mirror={0.55}
            depthScale={0.6}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            roughness={0.55}
            metalness={0.25}
          />
        ) : (
          <meshStandardMaterial map={tex} roughness={0.42} metalness={0.15} />
        )}
      </mesh>
      {/* ivičnjaci */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 3.6, 0.07, -80]} material={MATERIALS.stone} receiveShadow>
          <boxGeometry args={[0.32, 0.14, 220]} />
        </mesh>
      ))}
      {/* vrt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -80]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#cdbf9a" roughness={1} />
      </mesh>
    </group>
  )
}

// Nebo zlatnog sata: gradijent + sunčev sjaj (shader, bez slika).
export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { sunDir: { value: new THREE.Vector3(-0.45, 0.16, -0.88).normalize() } },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: `
          uniform vec3 sunDir;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, -0.2, 1.0);
            vec3 horizon = vec3(0.99, 0.89, 0.74);
            vec3 mid = vec3(0.96, 0.86, 0.74);
            vec3 top = vec3(0.86, 0.80, 0.78);
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
            col = mix(col, top, smoothstep(0.18, 0.75, h));
            float s = max(dot(normalize(vDir), sunDir), 0.0);
            col += vec3(1.0, 0.78, 0.45) * pow(s, 18.0) * 0.55;
            col += vec3(1.0, 0.92, 0.75) * pow(s, 400.0) * 0.9;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  )
}

// Latice koje lagano padaju oko kamere.
export function FallingPetals({ count }) {
  const ref = useRef()
  const { camera } = useThree()
  const tex = useMemo(() => petalTexture(), [])
  const data = useMemo(() => {
    const r = rng(23)
    return Array.from({ length: count }, () => ({
      x: (r() - 0.5) * 22,
      y: r() * 10,
      z: (r() - 0.5) * 30,
      spin: r() * Math.PI * 2,
      speed: 0.35 + r() * 0.45,
      sway: 0.5 + r(),
      s: 0.08 + r() * 0.07,
    }))
  }, [count])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((state, dt) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const cz = camera.position.z
    const cx = camera.position.x
    for (let i = 0; i < data.length; i++) {
      const p = data[i]
      p.y -= p.speed * dt
      p.z += dt * 1.6 // vjetar od kretanja
      if (p.y < 0) p.y += 10
      const rz = ((((p.z - cz) % 30) + 45) % 30) - 15
      const rx = ((((p.x - cx) % 22) + 33) % 22) - 11
      dummy.position.set(cx + rx + Math.sin(t * p.sway + i) * 0.4, p.y, cz + rz)
      dummy.rotation.set(t * p.sway + p.spin, p.spin + t * 0.6, Math.sin(t + i) * 0.8)
      dummy.scale.setScalar(p.s)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[1, 1.3]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.3} side={THREE.DoubleSide} roughness={0.6} />
    </instancedMesh>
  )
}
