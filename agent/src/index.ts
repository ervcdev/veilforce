import path from 'path'
import * as dotenv from 'dotenv'
import {
  createAgentClients,
  setupAgent,
  commitOrder,
  waitForRevealWindow,
  revealOrder,
  sleep
} from './commitReveal'
import { getNextOrderParams }     from './strategies/marketMaker'
import { getArbitrageParams }     from './strategies/arbitrage'
import { getConservativeParams }  from './strategies/conservative'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
// ─── Config Corregida (Autodetección de Wallet según Estrategia) ────────────────

const STRATEGY = process.env.AGENT_STRATEGY || 'marketMaker'

// Mapea automáticamente cada estrategia a su llave correspondiente
let AGENT_INDEX = 1
if (STRATEGY === 'arbitrage') AGENT_INDEX = 2
if (STRATEGY === 'conservative') AGENT_INDEX = 3

const PRIVATE_KEYS: Record<number, `0x${string}`> = {
  1: process.env.AGENT_1_PRIVATE_KEY as `0x${string}`,
  2: process.env.AGENT_2_PRIVATE_KEY as `0x${string}`,
  3: process.env.AGENT_3_PRIVATE_KEY as `0x${string}`
}
// ─── Loop principal ───────────────────────────────────────────────────────────

async function runAgent() {
  const privateKey = PRIVATE_KEYS[AGENT_INDEX]

  if (!privateKey) {
    console.error(`✗ No se encontró AGENT_${AGENT_INDEX}_PRIVATE_KEY en .env`)
    process.exit(1)
  }

  const { walletClient, publicClient, account } = createAgentClients(privateKey)

  console.log(`\n══════════════════════════════════════════`)
  console.log(`  VeilForge Agent #${AGENT_INDEX}`)
  console.log(`  Estrategia: ${STRATEGY}`)
  console.log(`  Address:    ${account.address}`)
  console.log(`══════════════════════════════════════════\n`)

  // Setup: register + approve tokens (con receipts — fix A-3)
  await setupAgent(walletClient, publicClient, account)

  let ciclo = 0

  while (true) {
    ciclo++
    console.log(`[${account.address.slice(0, 6)}] ── Ciclo #${ciclo} ──`)

    try {
      // 1. Calcular parámetros según estrategia
      // [FIX A-4] pasar publicClient a getArbitrageParams
      let params
      switch (STRATEGY) {
        case 'arbitrage':
          params = await getArbitrageParams(publicClient)
          break
        case 'conservative':
          params = getConservativeParams()
          break
        default:
          params = getNextOrderParams() // marketMaker
      }

      // 2. Commit
      const committed = await commitOrder(walletClient, publicClient, account, params)

      // 3. Esperar ventana — lanza error si expira (fix A-2)
      await waitForRevealWindow(publicClient, committed.commitBlock, account)

      // 4. Reveal
      await revealOrder(walletClient, publicClient, account, committed)

      console.log(`[${account.address.slice(0, 6)}] ✓ Ciclo #${ciclo} completado\n`)

    } catch (err: any) {
      console.error(`[${account.address.slice(0, 6)}] ✗ Error ciclo #${ciclo}: ${err.message}`)

      // [FIX GAP-5] backoff según tipo de error — evita loop de slashing
      if (err.message.includes('Reveal window expiró')) {
        console.warn(`[${account.address.slice(0, 6)}] ⚠ Ventana expirada — esperando 15s`)
        await sleep(15_000)
        continue
      }

      if (err.message.includes('nonce') || err.message.includes('network')) {
        console.warn(`[${account.address.slice(0, 6)}] ⚠ Error de red — esperando 5s`)
        await sleep(5_000)
        continue
      }

      // Error desconocido — pausa corta y continuar
      await sleep(2_000)
    }

    // Pausa normal entre ciclos
    await sleep(3_000)
  }
}

// ─── Manejo de errores globales ───────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Promise rechazada:', reason)
  process.exit(1)
})

// ─── Arrancar ─────────────────────────────────────────────────────────────────

runAgent().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})