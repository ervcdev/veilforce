// VeilForge — commitReveal.ts
// Fixes aplicados: A-1, A-2, A-3, A-6, GAP-3, TS-4, TS-FINAL-1
//
// TS-FINAL-1: account: account.address agregado en las 5 llamadas writeContract
// A-1: orderId desde decodeEventLog — no desde orderCount global
// A-2: maxBlock check — lanza error si ventana expiró
// A-3: waitForTransactionReceipt en todas las txs de setup
// A-6: imports limpios — sin toHex ni pad
// GAP-3: validación de Direction, price y amount en hashOrder
// TS-4: somniaTestnet importado explícitamente

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  encodePacked,
  keccak256,
  decodeEventLog,
  type WalletClient,
  type PublicClient
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { somniaTestnet } from './config'          // [FIX TS-4]
import { CLOB_ABI, ERC20_ABI, REGISTRY_ABI } from './abis'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config()

// ─── Types ────────────────────────────────────────────────────────────────────

export type Direction = 0 | 1  // 0 = BID, 1 = ASK

export interface OrderParams {
  price:     bigint    // precio en USDC con 18 decimals
  amount:    bigint    // cantidad de tokenA con 18 decimals
  direction: Direction
}

export interface CommittedOrder {
  orderId:     bigint
  params:      OrderParams
  salt:        `0x${string}`
  commitBlock: bigint
}

// Estado en memoria — guarda salt entre commit y reveal
// NUNCA persiste onchain — el salt debe mantenerse secreto hasta el reveal
const pendingOrders = new Map<bigint, CommittedOrder>()

// ─── Clientes Viem ────────────────────────────────────────────────────────────

export function createAgentClients(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)

  const walletClient = createWalletClient({
    account,
    chain:     somniaTestnet,                      // [FIX TS-4] chain explícito
    transport: http(process.env.SOMNIA_RPC_URL!)
  })

  const publicClient = createPublicClient({
    chain:     somniaTestnet,                      // [FIX TS-4] chain explícito
    transport: http(process.env.SOMNIA_RPC_URL!)
  })

  return { walletClient, publicClient, account }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateSalt(): `0x${string}` {
  const bytes = crypto.randomBytes(32)
  return `0x${bytes.toString('hex')}`
}

// [FIX GAP-3] validación de Direction, price y amount antes de hashear
// Evita producir un hash silenciosamente incorrecto con valores inválidos
export function hashOrder(
  params: OrderParams,
  salt:   `0x${string}`
): `0x${string}` {
  if (params.direction !== 0 && params.direction !== 1) {
    throw new Error(
      `Direction inválida: ${params.direction}. Debe ser 0 (BID) o 1 (ASK)`
    )
  }
  if (params.price <= BigInt(0)) {
    throw new Error(`Price inválido: ${params.price}. Debe ser > 0`)
  }
  if (params.amount <= BigInt(0)) {
    throw new Error(`Amount inválido: ${params.amount}. Debe ser > 0`)
  }

  return keccak256(
    encodePacked(
      ['uint256', 'uint256', 'uint8', 'bytes32'],
      [params.price, params.amount, params.direction, salt]
    )
  )
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getPendingOrders(): Map<bigint, CommittedOrder> {
  return pendingOrders
}

// ─── Setup inicial del agente ─────────────────────────────────────────────────

// [FIX A-3] todas las txs esperan receipt antes de continuar
// [FIX TS-FINAL-1] account: account.address en todas las llamadas writeContract
export async function setupAgent(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account:      ReturnType<typeof privateKeyToAccount>
) {
  const registryAddress = process.env.AGENT_REGISTRY_ADDRESS     as `0x${string}`
  const clobAddress     = process.env.COMMIT_REVEAL_CLOB_ADDRESS  as `0x${string}`
  const tokenAAddress   = process.env.TOKEN_A_ADDRESS             as `0x${string}`
  const tokenBAddress   = process.env.TOKEN_B_ADDRESS             as `0x${string}`
  const collateral      = parseEther(process.env.COLLATERAL_AMOUNT || '0.01')
  const MAX_UINT        = BigInt(
    '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  )

  // 1. Registrar si no está registrado
  const isRegistered = await publicClient.readContract({
    address:      registryAddress,
    abi:          REGISTRY_ABI,
    functionName: 'isRegistered',
    args:         [account.address]
  }) as boolean

  if (!isRegistered) {
    console.log(`[${account.address.slice(0, 6)}] Registrando agente...`)
    const txHash = await walletClient.writeContract({
      address:      registryAddress,
      abi:          REGISTRY_ABI,
      functionName: 'registerAgent',
      value:        collateral,
      account:      account.address  // [FIX TS-FINAL-1]
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash }) // [FIX A-3]
    console.log(
      `[${account.address.slice(0, 6)}] ✓ Registrado con ${process.env.COLLATERAL_AMOUNT} STT`
    )
  } else {
    console.log(`[${account.address.slice(0, 6)}] ✓ Ya registrado`)
  }

  // 2. Approve tokenA al CLOB
  const allowanceA = await publicClient.readContract({
    address:      tokenAAddress,
    abi:          ERC20_ABI,
    functionName: 'allowance',
    args:         [account.address, clobAddress]
  }) as bigint

  if (allowanceA < parseEther('1000')) {
    console.log(`[${account.address.slice(0, 6)}] Aprobando TokenA...`)
    const txHash = await walletClient.writeContract({
      address:      tokenAAddress,
      abi:          ERC20_ABI,
      functionName: 'approve',
      args:         [clobAddress, MAX_UINT],
      account:      account.address  // [FIX TS-FINAL-1]
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash }) // [FIX A-3]
    console.log(`[${account.address.slice(0, 6)}] ✓ TokenA aprobado`)
  }

  // 3. Approve tokenB al CLOB
  const allowanceB = await publicClient.readContract({
    address:      tokenBAddress,
    abi:          ERC20_ABI,
    functionName: 'allowance',
    args:         [account.address, clobAddress]
  }) as bigint

  if (allowanceB < parseEther('1000')) {
    console.log(`[${account.address.slice(0, 6)}] Aprobando TokenB...`)
    const txHash = await walletClient.writeContract({
      address:      tokenBAddress,
      abi:          ERC20_ABI,
      functionName: 'approve',
      args:         [clobAddress, MAX_UINT],
      account:      account.address  // [FIX TS-FINAL-1]
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash }) // [FIX A-3]
    console.log(`[${account.address.slice(0, 6)}] ✓ TokenB aprobado`)
  }

  console.log(`[${account.address.slice(0, 6)}] ✓ Setup completo\n`)
}

// ─── Commit ───────────────────────────────────────────────────────────────────

// [FIX TS-FINAL-1] account: account.address en writeContract
// [FIX A-1] orderId desde decodeEventLog — no desde orderCount global
export async function commitOrder(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account:      ReturnType<typeof privateKeyToAccount>,
  params:       OrderParams
): Promise<CommittedOrder> {
  const clobAddress = process.env.COMMIT_REVEAL_CLOB_ADDRESS as `0x${string}`

  const salt       = generateSalt()
  const commitment = hashOrder(params, salt) // [FIX GAP-3] valida params

  console.log(
    `[${account.address.slice(0, 6)}] Committing ` +
    `${params.direction === 0 ? 'BID' : 'ASK'} ` +
    `${params.amount / BigInt(10 ** 18)} WETH @ ` +
    `${params.price  / BigInt(10 ** 18)} USDC`
  )

  const txHash = await walletClient.writeContract({
    address:      clobAddress,
    abi:          CLOB_ABI,
    functionName: 'commitOrder',
    args:         [commitment],
    account:      account.address  // [FIX TS-FINAL-1]
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  // [FIX A-1] leer orderId del evento OrderCommitted
  // orderCount global es incorrecto con múltiples agentes concurrentes
  let orderId: bigint | undefined

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi:       CLOB_ABI,
        data:      log.data,
        topics:    log.topics,
        eventName: 'OrderCommitted'
      })
      // Verificar que el evento pertenece a este agente
      if (
        (decoded.args as any).agent?.toLowerCase() ===
        account.address.toLowerCase()
      ) {
        orderId = (decoded.args as any).orderId as bigint
        break
      }
    } catch {
      continue // log de otro contrato — ignorar
    }
  }

  if (orderId === undefined) {
    throw new Error(
      'No se encontró evento OrderCommitted en el receipt — la tx puede haber fallado'
    )
  }

  const commitBlock = BigInt(receipt.blockNumber)
  const committed: CommittedOrder = { orderId, params, salt, commitBlock }

  pendingOrders.set(orderId, committed)

  console.log(
    `[${account.address.slice(0, 6)}] ✓ Commit — orderId=${orderId} bloque=${commitBlock}`
  )

  return committed
}

// ─── Reveal Window ────────────────────────────────────────────────────────────

// [FIX A-2] usa REVEAL_WINDOW_BLOCKS del .env y lanza error si la ventana expiró
export async function waitForRevealWindow(
  publicClient: PublicClient,
  commitBlock:  bigint,
  account:      ReturnType<typeof privateKeyToAccount>
) {
  const revealWindowBlocks = parseInt(
    process.env.REVEAL_WINDOW_BLOCKS || '5'
  )
  const targetBlock = commitBlock + BigInt(1)               // mínimo 1 bloque
  const maxBlock    = commitBlock + BigInt(revealWindowBlocks) // máximo antes de expirar

  console.log(
    `[${account.address.slice(0, 6)}] ` +
    `Esperando bloque ${targetBlock} (ventana cierra en ${maxBlock})...`
  )

  while (true) {
    const currentBlock = await publicClient.getBlockNumber()

    // [FIX A-2] lanzar error si la ventana expiró
    // El loop de index.ts lo captura y aplica backoff de 15s (GAP-5)
    if (currentBlock > maxBlock) {
      throw new Error(
        `Reveal window expiró — ` +
        `commit: ${commitBlock}, actual: ${currentBlock}, max: ${maxBlock}`
      )
    }

    if (currentBlock >= targetBlock) break

    await sleep(300) // Somnia es rápido — revisar cada 300ms
  }

  console.log(`[${account.address.slice(0, 6)}] ✓ Ventana de reveal abierta`)
}

// ─── Reveal ───────────────────────────────────────────────────────────────────

// [FIX TS-FINAL-1] account: account.address en writeContract
export async function revealOrder(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account:      ReturnType<typeof privateKeyToAccount>,
  committed:    CommittedOrder
): Promise<boolean> {
  const clobAddress = process.env.COMMIT_REVEAL_CLOB_ADDRESS as `0x${string}`

  try {
    console.log(
      `[${account.address.slice(0, 6)}] Revelando orderId=${committed.orderId}...`
    )

    const txHash = await walletClient.writeContract({
      address:      clobAddress,
      abi:          CLOB_ABI,
      functionName: 'revealOrder',
      args: [
        committed.orderId,
        committed.params.price,
        committed.params.amount,
        committed.params.direction,
        committed.salt
      ],
      account: account.address  // [FIX TS-FINAL-1]
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })

    pendingOrders.delete(committed.orderId)

    console.log(
      `[${account.address.slice(0, 6)}] ✓ Reveal exitoso — orderId=${committed.orderId}`
    )
    return true

  } catch (err: any) {
    console.error(
      `[${account.address.slice(0, 6)}] ✗ Error en reveal: ${err.message}`
    )
    pendingOrders.delete(committed.orderId)
    return false
  }
}