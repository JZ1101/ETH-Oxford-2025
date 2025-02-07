import { ChainId, Token } from '@traderjoe-xyz/sdk-core'
import { PairV2, LB_ROUTER_V22_ADDRESS, jsonAbis, } from '@traderjoe-xyz/sdk-v2'
import { getContract, createPublicClient, createWalletClient, http, BaseError, ContractFunctionRevertedError } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { avalanche } from 'viem/chains'
import { config } from 'dotenv';

// Constants: chain and wallet
// Problem: web3react or wagmi to connect to a wallet
config();
const privateKey = process.env.PRIVATE_KEY;
const { LBRouterV22ABI, LBPairV21ABI } = jsonAbis
const CHAIN_ID = ChainId.AVALANCHE
const router = LB_ROUTER_V22_ADDRESS[CHAIN_ID]
const account = privateKeyToAccount(`0x${privateKey}`)

// Constants: tokens and LBPair bin step
const USDC = new Token(
    CHAIN_ID,  // The blockchain network (e.g., Avalanche Mainnet or Fuji Testnet)
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',  // The USDC token contract address
    6,  // Decimals (USDC uses 6 decimal places)
    'USDC',  // Token symbol
    'USD Coin'  // Token name
  )
  
  const USDC_E = new Token(
    CHAIN_ID,
    '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
    6,
    'USDC.e',
    'USD Coin bridged'
  )
  
  const BIN_STEP = "1"


// 2. Create Viem clients
const publicClient = createPublicClient({
    chain: avalanche,
    transport: http()
})

const walletClient = createWalletClient({
    account,
    chain: avalanche,
    transport: http()
})

//3. Getting data
// LBPair and active bin
const pair = new PairV2(USDC, USDC_E)
const binStep = Number(BIN_STEP)
const pairVersion = 'v22'
const lbPair = await pair.fetchLBPair(binStep, pairVersion, publicClient, CHAIN_ID)
if (lbPair.LBPair == "0x0000000000000000000000000000000000000000") {
    console.log("No LB pair found with given parameters")
    return
}
const lbPairData = await PairV2.getLBPairReservesAndId(lbPair.LBPair, pairVersion, publicClient)
const activeBinId = lbPairData.activeId.toNumber()

// Liquidity positions
// Use the below code to fetch positions directly from chain. Need all the binIds where it covers liquidity and the amount of liquidity in each bin.

const pairContract = getContract({ address: lbPair.LBPair, abi: LBPairV21ABI })
const range = 200 // should be enough in most cases
const addressArray = Array.from({ length: 2 * range + 1 }).fill(account.address);
const binsArray = [];
for (let i = activeBinId - range; i <= activeBinId + range; i++) {
    binsArray.push(i);
}
const allBins: Bigint[] = await publicClient.readContract({
    address: pairContract.address,
    abi: pairContract.abi,
    functionName: 'balanceOfBatch',
    args: [addressArray, binsArray]
})
const userOwnedBins = binsArray.filter((bin, index) => allBins[index] != 0n);
const nonZeroAmounts = allBins.filter(amount => amount !== 0n);

// 4 Grant LBRouter access to your LBTokens
const approved = await publicClient.readContract({
    address: pairContract.address,
    abi: pairContract.abi,
    functionName: 'isApprovedForAll',
    args: [account.address, router]
})

if (!approved) {
    const { request } = await publicClient.simulateContract({
        address: pairContract.address,
        abi: pairContract.abi,
        functionName: 'approveForAll',
        args: [router, true],
        account
    })
    const hashApproval = await walletClient.writeContract(request)
    console.log(`Approving transaction sent with hash ${hashApproval}`)
}

// 5. Set removeLiquidity parameters
// set transaction deadline
const currentTimeInSec =  Math.floor((new Date().getTime()) / 1000)

// set array of remove liquidity parameters
const removeLiquidityInput = {
    tokenX: USDC_E.address,
    tokenY: USDC.address,
    binStep: Number(BIN_STEP),
    amountXmin: 0,
    amountYmin: 0,
    ids: userOwnedBins,
    amounts: nonZeroAmounts,
    to: account.address,
    deadline: currentTimeInSec + 3600
}

// 6. Execute removeLiquidity contract call
const { request } = await publicClient.simulateContract({
    address: router,
    abi: LBRouterV22ABI,
    functionName: "removeLiquidity",
    args: [
        removeLiquidityInput.tokenX,
        removeLiquidityInput.tokenY,
        removeLiquidityInput.binStep,
        removeLiquidityInput.amountXmin, //zero in this example
        removeLiquidityInput.amountYmin, //zero in this example
        removeLiquidityInput.ids,
        removeLiquidityInput.amounts,
        removeLiquidityInput.to,
        removeLiquidityInput.deadline],
    account
})
const removalHash = await walletClient.writeContract(request)
console.log(`Transaction sent with hash ${removalHash}`)