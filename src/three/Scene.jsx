import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import Car, { CAR_WHEEL_RADIUS } from './Car.jsx'
import { Arcades, FallingPetals, Road, Rotunda, Sky } from './World.jsx'
import { reducedMotion, sceneState } from './state.js'

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

// Filmski kadrovi (pozicija kamere i tačka gledanja) u odnosu na automobil,
// vezani za napredak kroz pozivnicu. Između kadrova kamera klizi glatko.
const SHOTS = [
  { p: 0.0, pos: [3.9, 1.25, -7.2], look: [0, 1.75, -0.6] }, // naslov – prednja 3/4
  { p: 0.14, pos: [6.9, 1.5, -1.0], look: [0, 0.95, -0.6] }, // bočno praćenje
  { p: 0.3, pos: [-2.7, 3.5, 8.6], look: [0, 1.7, -10] }, // kran iza auta kroz arkade
  { p: 0.46, pos: [-1.7, 0.55, -9.4], look: [0, 2.3, 2] }, // nisko ispred, pogled na lukove
  { p: 0.62, pos: [8.5, 11, 9.5], look: [0, 0, -6] }, // iz zraka
  { p: 0.8, pos: [-4.6, 2.2, 6.6], look: [0, 2.2, -18] }, // prema kući mlade
  { p: 1.0, pos: [2.0, 3.8, 11.5], look: [0, 3.6, -22] }, // završni kadar s rotondom
]
const INTRO = { pos: [-1.5, 10.5, -26], look: [0, 1.2, -2] }

function shotAt(p, outPos, outLook) {
  let i = 0
  while (i < SHOTS.length - 2 && p > SHOTS[i + 1].p) i++
  const a = SHOTS[i]
  const b = SHOTS[i + 1]
  const t = smooth(a.p, b.p, p)
  outPos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t))
  outLook.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t))
}

function Director({ carRef, wheelRefs, rotundaRef, travelRef, hideBeyondRef }) {
  const target = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), intro: new THREE.Vector3() }), [])
  const look = useRef(new THREE.Vector3(...INTRO.look))
  const lastP = useRef(0)
  const speedRef = useRef(0)
  const reduced = useMemo(() => reducedMotion(), [])
  const first = useRef(true)

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = state.clock.elapsedTime
    const p = sceneState.progress
    const cam = state.camera

    // Brzina vožnje: stalno u pokretu, skrol dodaje zamah, pred kraj usporava ispred kuće mlade.
    const scrollVel = Math.min(14, (Math.abs(p - lastP.current) / Math.max(dt, 0.001)) * 55)
    lastP.current = p
    const arrive = 1 - 0.82 * smooth(0.84, 1, p)
    const want = (4.2 + scrollVel) * arrive * (reduced ? 0.5 : 1)
    speedRef.current = lerp(speedRef.current, want, 1 - Math.exp(-dt * 2.2))
    const dist = speedRef.current * dt
    travelRef.current += dist

    // Kotači i lagano njihanje karoserije.
    for (const w of wheelRefs) if (w.current) w.current.rotation.z -= dist / CAR_WHEEL_RADIUS
    if (carRef.current) {
      carRef.current.position.y = Math.sin(t * 9) * 0.006 * Math.min(1, speedRef.current / 4)
      carRef.current.rotation.z = Math.sin(t * 0.7) * 0.004
      carRef.current.rotation.x = -(want - speedRef.current) * 0.0025
    }

    // Kuća mlade (rotonda) se približava kako se gost bliži kraju pozivnice.
    const rz = -lerp(190, 25, smooth(0.66, 1, p))
    if (rotundaRef.current) rotundaRef.current.position.z = rz
    hideBeyondRef.current = rz + 14

    // Kamera – na uskim (uspravnim) ekranima šire vidno polje i malo veća udaljenost.
    const aspect = state.size.width / Math.max(1, state.size.height)
    const fov = aspect < 1 ? 50 : 40
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    const f = aspect < 1 ? 1 + (1 - aspect) * 0.75 : 1
    shotAt(p, target.pos, target.look)
    target.pos.x *= f
    target.pos.z *= f
    target.pos.y *= 1 + (f - 1) * 0.5
    if (!reduced) {
      target.pos.x += Math.sin(t * 0.23) * 0.25
      target.pos.y += Math.sin(t * 0.31) * 0.12
    }
    const since = sceneState.opened ? (performance.now() - sceneState.openedAt) / 1000 : 0
    const intro = sceneState.opened ? smooth(0, 4.2, since) : 0
    if (intro < 1) {
      target.intro.set(...INTRO.pos)
      target.pos.lerp(target.intro, 1 - intro)
      target.look.lerp(new THREE.Vector3(...INTRO.look), 1 - intro)
    }
    const k = first.current ? 1 : 1 - Math.exp(-dt * (intro < 1 ? 6 : 2.6))
    first.current = false
    cam.position.lerp(target.pos, k)
    look.current.lerp(target.look, k)
    cam.lookAt(look.current)
  })
  return null
}

function Lights({ quality }) {
  const size = quality === 'high' ? 2048 : quality === 'mid' ? 1024 : 512
  return (
    <>
      <hemisphereLight args={['#fff0d4', '#a88a58', 0.6]} />
      <directionalLight
        position={[-11, 13, -12]}
        intensity={3.3}
        color="#ffd296"
        castShadow={quality !== 'low'}
        shadow-mapSize={[size, size]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <directionalLight position={[9, 4, 10]} intensity={0.55} color="#fff6ea" />
    </>
  )
}

function Studio({ quality }) {
  // Okruženje za refleksije na laku automobila (svjetlosni paneli, bez vanjskih HDR fajlova).
  return (
    <Environment resolution={quality === 'high' ? 256 : 128} frames={1}>
      <color attach="background" args={['#ead9bd']} />
      <Lightformer form="rect" intensity={2.4} color="#fff4df" position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[22, 8, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#ffd29a" position={[-9, 2.2, -5]} rotation-y={Math.PI / 2} scale={[16, 1.4, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[9, 2.5, 3]} rotation-y={-Math.PI / 2} scale={[16, 1.2, 1]} />
      <Lightformer form="ring" intensity={5} color="#ffc983" position={[-12, 6, -16]} scale={5} />
      <Lightformer form="rect" intensity={1.2} color="#f3e1c2" position={[0, 1, 12]} scale={[18, 3, 1]} />
    </Environment>
  )
}

function World({ quality, reflect }) {
  const carRef = useRef()
  const rotundaRef = useRef()
  const travelRef = useRef(0)
  const hideBeyondRef = useRef(-1e9)
  const wheelRefs = [useRef(), useRef(), useRef(), useRef()]

  return (
    <>
      <Director carRef={carRef} wheelRefs={wheelRefs} rotundaRef={rotundaRef} travelRef={travelRef} hideBeyondRef={hideBeyondRef} />
      <Sky />
      <fog attach="fog" args={['#f4e0c0', 28, 125]} />
      <Lights quality={quality} />
      <Studio quality={quality} />
      <Road quality={quality} travelRef={travelRef} reflect={reflect} />
      <Arcades quality={quality} travelRef={travelRef} hideBeyondRef={hideBeyondRef} />
      <Rotunda groupRef={rotundaRef} />
      <Car ref={carRef} wheelRefs={wheelRefs} />
      <FallingPetals count={quality === 'high' ? 220 : quality === 'mid' ? 120 : 60} />
      <Sparkles count={quality === 'low' ? 35 : 80} scale={[16, 6, 26]} position={[0, 3, -6]} size={3.5} speed={0.3} color="#f6d58e" opacity={0.85} />
    </>
  )
}

export default function Scene({ tier, active }) {
  const [quality, setQuality] = useState(tier)
  const [reflect, setReflect] = useState(tier !== 'low')
  const [dpr, setDpr] = useState(tier === 'high' ? 1.75 : tier === 'mid' ? 1.5 : 1.15)

  return (
    <Canvas
      className="scene-canvas"
      shadows={quality !== 'low' ? 'soft' : false}
      dpr={dpr}
      frameloop={active ? 'always' : 'demand'}
      camera={{ fov: 42, near: 0.1, far: 400, position: INTRO.pos }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.96
      }}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => {
          // Slabiji uređaj: niža rezolucija, bez ogledalne refleksije – animacija ostaje glatka.
          setDpr((d) => Math.max(1, d - 0.35))
          setReflect(false)
          if (quality === 'high') setQuality('mid')
        }}
        onFallback={() => {
          setDpr(1)
          setReflect(false)
          setQuality('low')
        }}
      />
      <World quality={quality} reflect={reflect} />
    </Canvas>
  )
}
