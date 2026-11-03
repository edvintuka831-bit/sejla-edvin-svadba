import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'

// Bijeli luksuzni svadbeni automobil – proceduralno modeliran (bez vanjskih 3D fajlova).
// Profil karoserije se "izvlači" u 3D (ExtrudeGeometry) sa zaobljenim ivicama.
// Duža osa je X; grupa se rotira tako da prednji dio gleda u smjeru vožnje (-Z).

const WHEEL_X = 1.55
const WHEEL_R = 0.42
const WIDTH = 1.78

function bodyShape() {
  const s = new THREE.Shape()
  s.moveTo(-2.3, 0.42)
  s.lineTo(-2.05, 0.42)
  s.absarc(-WHEEL_X, 0.42, 0.52, Math.PI, 0, true)
  s.lineTo(1.03, 0.42)
  s.absarc(WHEEL_X, 0.42, 0.52, Math.PI, 0, true)
  s.lineTo(2.3, 0.42)
  s.quadraticCurveTo(2.56, 0.46, 2.54, 0.7)
  s.quadraticCurveTo(2.5, 0.9, 2.2, 0.95)
  s.lineTo(0.62, 1.07)
  s.lineTo(-1.3, 1.1)
  s.lineTo(-2.22, 1.02)
  s.quadraticCurveTo(-2.5, 0.98, -2.5, 0.76)
  s.quadraticCurveTo(-2.5, 0.46, -2.3, 0.42)
  return s
}

function cabinShape() {
  const s = new THREE.Shape()
  s.moveTo(0.62, 1.04)
  s.quadraticCurveTo(0.2, 1.36, -0.1, 1.56)
  s.lineTo(-0.95, 1.6)
  s.quadraticCurveTo(-1.35, 1.45, -1.62, 1.06)
  s.lineTo(0.62, 1.04)
  return s
}

function extrude(shape, depth, bevel, steps = 1) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 24,
  })
  g.translate(0, 0, -depth / 2)
  g.computeVertexNormals()
  return g
}

export function useCarMaterials() {
  return useMemo(
    () => ({
      paint: new THREE.MeshPhysicalMaterial({
        color: '#fbf8f1',
        metalness: 0.25,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        sheen: 0.4,
        sheenColor: new THREE.Color('#f3dfb5'),
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#16130f',
        metalness: 0.5,
        roughness: 0.04,
        clearcoat: 1,
        envMapIntensity: 1.1,
      }),
      chrome: new THREE.MeshStandardMaterial({ color: '#f4eadb', metalness: 1, roughness: 0.12 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d5b36d', metalness: 1, roughness: 0.25 }),
      tire: new THREE.MeshStandardMaterial({ color: '#1d1b19', roughness: 0.85 }),
      head: new THREE.MeshStandardMaterial({ color: '#fff8e8', emissive: '#ffe9b8', emissiveIntensity: 2.2 }),
      tail: new THREE.MeshStandardMaterial({ color: '#8f2a22', emissive: '#d9452f', emissiveIntensity: 1.2 }),
      ribbon: new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide }),
      roseWhite: new THREE.MeshStandardMaterial({ color: '#fffaf3', roughness: 0.55 }),
      roseBlush: new THREE.MeshStandardMaterial({ color: '#f1d3c6', roughness: 0.55 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#7f8d68', roughness: 0.7 }),
    }),
    [],
  )
}

function Wheel({ x, z, m, wheelRef }) {
  const spokes = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), [])
  return (
    <group position={[x, WHEEL_R, z]}>
      <group ref={wheelRef}>
        <mesh material={m.tire} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.3, 32]} />
        </mesh>
        <group position={[0, 0, z > 0 ? 0.152 : -0.152]} rotation={[0, z > 0 ? 0 : Math.PI, 0]}>
          <mesh material={m.chrome}>
            <torusGeometry args={[0.27, 0.03, 10, 36]} />
          </mesh>
          {spokes.map((a) => (
            <mesh key={a} material={m.chrome} rotation={[0, 0, a]} position={[Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0]}>
              <boxGeometry args={[0.03, 0.26, 0.02]} />
            </mesh>
          ))}
          <mesh material={m.gold} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.03, 20]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// Buket ruža na haubi + satenske trake prema retrovizorima.
function WeddingDecor({ m }) {
  const roses = useMemo(() => {
    const out = []
    let seed = 3
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(rnd()) * 0.24
      out.push({
        p: [Math.cos(a) * r * 0.7, 0.07 + rnd() * 0.08 + (0.24 - r) * 0.35, Math.sin(a) * r],
        s: 0.055 + rnd() * 0.035,
        blush: rnd() > 0.68,
      })
    }
    return out
  }, [])

  const ribbons = useMemo(() => {
    const make = (side) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(1.75, 1.02, 0),
          new THREE.Vector3(1.3, 1.02, side * 0.32),
          new THREE.Vector3(0.9, 1.06, side * 0.66),
          new THREE.Vector3(0.62, 1.12, side * 0.9),
        ]),
        24,
        0.022,
        6,
        false,
      )
    return [make(1), make(-1)]
  }, [])

  return (
    <group>
      <group position={[1.75, 0.98, 0]}>
        {roses.map((r, i) => (
          <mesh key={i} position={r.p} material={r.blush ? m.roseBlush : m.roseWhite} castShadow>
            <icosahedronGeometry args={[r.s, 1]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 0.05, s * 0.3]} rotation={[s * 0.4, 0, 0]} material={m.leaf}>
            <sphereGeometry args={[0.12, 10, 8]} />
          </mesh>
        ))}
        <mesh position={[0.22, 0.04, 0]} rotation={[0, 0, Math.PI / 2]} material={m.gold}>
          <torusGeometry args={[0.06, 0.018, 8, 20]} />
        </mesh>
      </group>
      {ribbons.map((g, i) => (
        <mesh key={i} geometry={g} material={m.ribbon} />
      ))}
    </group>
  )
}

const Car = forwardRef(function Car({ wheelRefs }, ref) {
  const m = useCarMaterials()
  const body = useMemo(() => extrude(bodyShape(), WIDTH - 0.24, 0.12), [])
  const cabin = useMemo(() => extrude(cabinShape(), WIDTH - 0.5, 0.1), [])
  const half = WIDTH / 2

  return (
    <group ref={ref}>
      {/* rotacija: +X profila → -Z (smjer vožnje) */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={body} material={m.paint} castShadow receiveShadow />
        <mesh geometry={cabin} material={m.glass} castShadow />
        {/* krov u boji karoserije */}
        <mesh position={[-0.52, 1.6, 0]} material={m.paint} castShadow>
          <boxGeometry args={[0.98, 0.07, WIDTH - 0.46]} />
        </mesh>
        {/* B-stub */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[-0.42, 1.32, s * (half - 0.2)]} rotation={[0, 0, -0.12]} material={m.paint}>
            <boxGeometry args={[0.1, 0.55, 0.06]} />
          </mesh>
        ))}
        {/* hromirane linije uz bok */}
        {[-1, 1].map((s) => (
          <mesh key={`c${s}`} position={[0.05, 0.72, s * (half + 0.005)]} material={m.chrome}>
            <boxGeometry args={[3.7, 0.025, 0.02]} />
          </mesh>
        ))}
        {/* maska hladnjaka */}
        <mesh position={[2.56, 0.66, 0]} material={m.chrome}>
          <boxGeometry args={[0.06, 0.26, 0.74]} />
        </mesh>
        {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
          <mesh key={`g${i}`} position={[2.6, 0.66, i * 0.1]} material={m.gold}>
            <boxGeometry args={[0.02, 0.22, 0.012]} />
          </mesh>
        ))}
        {/* farovi i stop svjetla */}
        {[-1, 1].map((s) => (
          <group key={`l${s}`}>
            <mesh position={[2.5, 0.76, s * 0.66]} material={m.head}>
              <boxGeometry args={[0.08, 0.1, 0.32]} />
            </mesh>
            <mesh position={[-2.5, 0.8, s * 0.66]} material={m.tail}>
              <boxGeometry args={[0.06, 0.08, 0.34]} />
            </mesh>
            {/* retrovizori */}
            <mesh position={[0.5, 1.15, s * (half + 0.08)]} material={m.paint} castShadow>
              <boxGeometry args={[0.16, 0.1, 0.16]} />
            </mesh>
          </group>
        ))}
        {/* branici */}
        <mesh position={[2.52, 0.47, 0]} material={m.chrome}>
          <boxGeometry args={[0.1, 0.07, WIDTH - 0.1]} />
        </mesh>
        <mesh position={[-2.5, 0.5, 0]} material={m.chrome}>
          <boxGeometry args={[0.1, 0.07, WIDTH - 0.1]} />
        </mesh>
        {/* ukras na haubi */}
        <mesh position={[2.32, 1.0, 0]} material={m.gold}>
          <sphereGeometry args={[0.04, 12, 10]} />
        </mesh>
        <WeddingDecor m={m} />

        <Wheel x={WHEEL_X} z={half - 0.1} m={m} wheelRef={wheelRefs[0]} />
        <Wheel x={WHEEL_X} z={-half + 0.1} m={m} wheelRef={wheelRefs[1]} />
        <Wheel x={-WHEEL_X} z={half - 0.1} m={m} wheelRef={wheelRefs[2]} />
        <Wheel x={-WHEEL_X} z={-half + 0.1} m={m} wheelRef={wheelRefs[3]} />
      </group>
    </group>
  )
})

export const CAR_WHEEL_RADIUS = WHEEL_R
export default Car
